import { NextResponse } from "next/server";

import { SCOPE, canonicalResource, requestOrigin } from "./core";

/**
 * OAuth 메타데이터 문서 — RFC 9728, RFC 8414
 *
 * MCP 클라이언트는 이 두 문서만 읽고 나머지를 스스로 알아낸다. 사용자가
 * 붙여 넣는 것은 서버 주소 하나뿐이다. 브리지도, 토큰 복사도 필요 없다.
 */

/**
 * 메타데이터는 누구나 읽을 수 있어야 한다.
 *
 * 비밀이 없고, 브라우저에서 도는 MCP 클라이언트가 교차 출처로 가져간다.
 * CORS를 막으면 그 클라이언트는 인증을 시작조차 못 한다.
 */
export function metadataResponse(document: object) {
  return NextResponse.json(document, {
    headers: {
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300",
    },
  });
}

export function metadataPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, OPTIONS",
      "access-control-allow-headers": "authorization, mcp-protocol-version",
      "access-control-max-age": "86400",
    },
  });
}

/** RFC 9728 — 이 리소스를 지키는 인가 서버가 누구인지 알린다. */
export function protectedResourceMetadata(request: Request) {
  const origin = requestOrigin(request);

  return {
    resource: canonicalResource(origin),
    // 명세가 MUST로 요구한다. 우리는 인가 서버를 겸하므로 자기 자신이다.
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ["header"],
    resource_name: "AI 스터디 협업 보드",
    resource_documentation: `${origin}/settings/mcp`,
  };
}

/** RFC 8414 — 인가·토큰·등록 엔드포인트의 위치. */
export function authorizationServerMetadata(request: Request) {
  const origin = requestOrigin(request);

  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/api/oauth/token`,
    registration_endpoint: `${origin}/api/oauth/register`,
    scopes_supported: [SCOPE],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    // OAuth 2.1이 MUST로 요구한다. plain은 싣지 않는다 — 실제로 받지도 않는다.
    code_challenge_methods_supported: ["S256"],
    // 공개 클라이언트만 받는다. 데스크톱 앱은 비밀을 안전히 보관할 수 없다.
    token_endpoint_auth_methods_supported: ["none"],
  };
}
