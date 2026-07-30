import { NextResponse } from "next/server";

import {
  SCOPE,
  canonicalResource,
  consumeAuthorizationCode,
  findClient,
  issueTokens,
  refreshTokens,
  requestOrigin,
  type IssuedTokens,
} from "@/lib/oauth/core";

/**
 * POST /api/oauth/token — 토큰 발급 (OAuth 2.1 §4.1.3, §4.3)
 *
 * 인가 코드를 액세스 토큰으로 바꾸고, 만료된 토큰을 리프레시로 갱신한다.
 * 본문은 form-urlencoded다. JSON이 아니다 — 명세가 그렇게 정했고 클라이언트
 * 라이브러리들이 그 형식으로 보낸다.
 *
 * 클라이언트 인증은 없다. 공개 클라이언트만 받기 때문이다. client_id는
 * 신원이 아니라 꼬리표일 뿐이고, 실제로 코드를 교환할 자격은 PKCE의
 * code_verifier가 증명한다.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const form = await readForm(request);

  if (!form) {
    return error(
      "invalid_request",
      "본문은 application/x-www-form-urlencoded여야 합니다.",
    );
  }

  const clientId = form.get("client_id");

  if (!clientId || !(await findClient(clientId))) {
    return error("invalid_client", "등록되지 않은 client_id입니다.", 401);
  }

  // 토큰 요청에도 resource를 실을 수 있다. 인가 때와 다른 값을 보내면
  // 조용히 다른 audience를 받아 가려는 시도다. 거절한다.
  const resource = canonicalResource(requestOrigin(request));
  const requested = form.get("resource");

  if (requested && requested.replace(/\/$/, "") !== resource) {
    return error("invalid_target", `이 서버는 ${resource}용 토큰만 냅니다.`);
  }

  switch (form.get("grant_type")) {
    case "authorization_code":
      return exchangeCode(form, clientId, resource);
    case "refresh_token":
      return exchangeRefresh(form, clientId);
    default:
      return error(
        "unsupported_grant_type",
        "authorization_code와 refresh_token만 지원합니다.",
      );
  }
}

async function exchangeCode(
  form: URLSearchParams,
  clientId: string,
  resource: string,
) {
  const code = form.get("code");
  const redirectUri = form.get("redirect_uri");
  const codeVerifier = form.get("code_verifier");

  if (!code || !redirectUri || !codeVerifier) {
    return error(
      "invalid_request",
      "code, redirect_uri, code_verifier가 모두 필요합니다.",
    );
  }

  const result = await consumeAuthorizationCode(
    code,
    clientId,
    redirectUri,
    codeVerifier,
  );

  if (!result.ok) return error(result.error, result.description);

  return tokenResponse(
    await issueTokens(clientId, result.userId, result.resource),
    resource,
  );
}

async function exchangeRefresh(form: URLSearchParams, clientId: string) {
  const refreshToken = form.get("refresh_token");

  if (!refreshToken) {
    return error("invalid_request", "refresh_token이 필요합니다.");
  }

  const result = await refreshTokens(refreshToken, clientId);

  if (!result.ok) return error(result.error, result.description);

  return tokenResponse(result.tokens, null);
}

function tokenResponse(tokens: IssuedTokens, resource: string | null) {
  return NextResponse.json(
    {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: tokens.expiresIn,
      refresh_token: tokens.refreshToken,
      scope: SCOPE,
      ...(resource ? { resource } : {}),
    },
    {
      headers: {
        "access-control-allow-origin": "*",
        // 토큰이 프록시나 브라우저 캐시에 남으면 안 된다. 명세가 MUST로 요구한다.
        "cache-control": "no-store",
        pragma: "no-cache",
      },
    },
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-max-age": "86400",
    },
  });
}

/**
 * 명세는 form-urlencoded를 요구하지만 JSON으로 보내는 클라이언트가 있다.
 * 받아 준다. 형식을 틀렸다고 연결이 안 되는 것보다 낫고, 어느 쪽으로 와도
 * 검증은 똑같이 거친다.
 */
async function readForm(request: Request): Promise<URLSearchParams | null> {
  const type = request.headers.get("content-type") ?? "";
  const body = await request.text();

  if (type.includes("application/json")) {
    try {
      const parsed: unknown = JSON.parse(body);
      if (!parsed || typeof parsed !== "object") return null;

      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") params.set(key, value);
      }
      return params;
    } catch {
      return null;
    }
  }

  return new URLSearchParams(body);
}

function error(code: string, description: string, status = 400) {
  return NextResponse.json(
    { error: code, error_description: description },
    {
      status,
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
      },
    },
  );
}
