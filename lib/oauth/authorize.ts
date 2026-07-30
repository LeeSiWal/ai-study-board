import { SCOPE, canonicalResource, findClient } from "./core";

/**
 * 인가 요청 검증 — OAuth 2.1 §4.1, RFC 8707
 *
 * 오류를 두 갈래로 나눈다. 그 구분이 이 파일의 핵심이다.
 *
 * client_id나 redirect_uri가 이상하면 **리다이렉트하지 않고** 화면에 세운다.
 * 그 두 값이 곧 "어디로 보낼지"이기 때문이다. 믿을 수 없는 주소로 오류를
 * 보내면 그 자체가 공개 리다이렉터가 되어, 공격자가 우리 도메인을 발판으로
 * 아무 데나 사람을 흘려보낼 수 있다.
 *
 * 나머지 오류는 등록된 주소로 돌려보낸다. 클라이언트가 사용자에게 무엇이
 * 잘못됐는지 보여줄 수 있어야 하기 때문이다.
 */

export interface AuthorizeRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
  state: string | null;
}

export type AuthorizeCheck =
  | { kind: "consent"; request: AuthorizeRequest }
  /** 리다이렉트할 수 없는 오류. 화면에 세운다. */
  | { kind: "halt"; title: string; detail: string }
  /** 클라이언트에게 돌려보낼 오류. */
  | { kind: "bounce"; location: string };

export async function checkAuthorizeRequest(
  params: URLSearchParams,
  origin: string,
): Promise<AuthorizeCheck> {
  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");

  if (!clientId) {
    return {
      kind: "halt",
      title: "client_id가 없습니다",
      detail: "인가 요청에 client_id가 필요합니다.",
    };
  }

  const client = await findClient(clientId);

  if (!client) {
    return {
      kind: "halt",
      title: "등록되지 않은 클라이언트입니다",
      detail: `client_id ${clientId}를 찾을 수 없습니다. 클라이언트에서 연결을 지우고 다시 추가해보세요.`,
    };
  }

  if (!redirectUri) {
    return {
      kind: "halt",
      title: "redirect_uri가 없습니다",
      detail: "인가 요청에 redirect_uri가 필요합니다.",
    };
  }

  // 정확히 일치해야 한다. 접두사만 봐도 통과시키면 공격자가 등록된 주소
  // 아래에 자기 경로를 붙여 인가 코드를 가져간다.
  if (!client.redirectUris.includes(redirectUri)) {
    return {
      kind: "halt",
      title: "등록되지 않은 redirect_uri입니다",
      detail: `${redirectUri}는 이 클라이언트가 등록한 주소가 아닙니다.`,
    };
  }

  // 여기서부터는 돌아갈 주소를 믿을 수 있다.
  const bounce = (error: string, description: string): AuthorizeCheck => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);

    return { kind: "bounce", location: url.toString() };
  };

  if (params.get("response_type") !== "code") {
    return bounce(
      "unsupported_response_type",
      "인가 코드 흐름(response_type=code)만 지원합니다.",
    );
  }

  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get("code_challenge_method");

  if (!codeChallenge) {
    return bounce("invalid_request", "code_challenge가 필요합니다(PKCE).");
  }

  // OAuth 2.1은 S256을 요구한다. plain을 허용하면 challenge가 verifier와
  // 같아져서, 인가 요청을 엿본 쪽이 그대로 코드를 교환할 수 있다.
  if (codeChallengeMethod !== "S256") {
    return bounce(
      "invalid_request",
      "code_challenge_method는 S256이어야 합니다.",
    );
  }

  const requestedScope = params.get("scope");

  if (requestedScope && requestedScope.split(/\s+/).some((s) => s !== SCOPE)) {
    return bounce("invalid_scope", `지원하는 scope는 ${SCOPE} 하나입니다.`);
  }

  // RFC 8707 — 토큰이 어느 서버용인지 요청 단계에서 못 박는다. 이걸 두지
  // 않으면 우리가 발급한 토큰을 클라이언트가 다른 MCP 서버에 그대로 보낼 수
  // 있고, 그쪽이 이 토큰으로 우리에게 되돌아올 수 있다.
  const resource = canonicalResource(origin);
  const requestedResource = params.get("resource");

  if (requestedResource && !sameResource(requestedResource, resource)) {
    return bounce(
      "invalid_target",
      `이 서버는 ${resource}에 대한 토큰만 발급합니다.`,
    );
  }

  return {
    kind: "consent",
    request: {
      clientId: client.clientId,
      clientName: client.name,
      redirectUri,
      codeChallenge,
      codeChallengeMethod,
      resource,
      state,
    },
  };
}

/** 끝 슬래시 차이로 거절하지 않는다. 그 외에는 같아야 한다. */
function sameResource(a: string, b: string): boolean {
  return a.replace(/\/$/, "") === b.replace(/\/$/, "");
}
