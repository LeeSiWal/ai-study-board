import { NextResponse } from "next/server";
import { z } from "zod";

import { registerClient } from "@/lib/oauth/core";
import { checkRedirectUri } from "@/lib/oauth/redirect-uri";

/**
 * POST /api/oauth/register — 동적 클라이언트 등록 (RFC 7591)
 *
 * MCP 클라이언트가 사람 손을 거치지 않고 스스로 등록한다. 사용자가 서버
 * 주소만 넣으면 클라이언트가 여기로 와서 client_id를 받아 간다.
 *
 * 인증을 두지 않는다. 등록 자체로 얻는 권한이 없기 때문이다 — client_id는
 * 사용자가 동의 화면에서 승인해야 비로소 무언가에 닿는다. 대신 아무나 행을
 * 만들 수 있으니 등록만으로 데이터가 새지 않도록 최소한만 저장한다.
 *
 * 공개 클라이언트만 받는다. 데스크톱 앱은 비밀을 안전히 보관할 수 없어
 * client_secret을 주는 것이 오히려 거짓 안심이 된다. 그 자리는 PKCE가 메운다.
 */
export const runtime = "nodejs";

const registerSchema = z.object({
  client_name: z.string().min(1).max(120).optional(),
  redirect_uris: z.array(z.string()).min(1).max(10),
  // 나머지 필드는 명세상 선택이고 우리가 쓰지 않는다. 모르는 필드가 와도
  // 거절하지 않는다 — RFC 7591이 서버는 이해하지 못한 항목을 무시하라고 한다.
});

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return error(
      "invalid_client_metadata",
      "redirect_uris는 1개 이상의 문자열 배열이어야 합니다.",
    );
  }

  for (const uri of parsed.data.redirect_uris) {
    const check = checkRedirectUri(uri);
    if (!check.ok) return error("invalid_redirect_uri", check.reason);
  }

  const client = await registerClient(
    parsed.data.client_name ?? "이름 없는 MCP 클라이언트",
    parsed.data.redirect_uris,
  );

  return NextResponse.json(
    {
      client_id: client.clientId,
      client_name: client.name,
      redirect_uris: client.redirectUris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    },
    {
      status: 201,
      headers: {
        "access-control-allow-origin": "*",
        "cache-control": "no-store",
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
      "access-control-allow-headers": "content-type",
      "access-control-max-age": "86400",
    },
  });
}

function error(code: string, description: string) {
  return NextResponse.json(
    { error: code, error_description: description },
    { status: 400, headers: { "access-control-allow-origin": "*" } },
  );
}
