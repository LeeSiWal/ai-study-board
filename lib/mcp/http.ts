/**
 * Streamable HTTP 전송의 규약 검사 — MCP 명세 2025-06-18
 *
 * 프로토콜 처리는 SDK가 하지만, 전송 계층의 요구사항은 라우트가 지켜야 한다.
 * 여기 모아 두어 라우트가 무엇을 검사하는지 한눈에 보이게 한다.
 */

/**
 * 우리가 이해하는 프로토콜 버전.
 *
 * 명세는 알 수 없는 버전에 400을 돌려주라고 한다. 조용히 받아주면 클라이언트가
 * 우리가 지원하지 않는 동작을 기대하게 된다.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

/**
 * 헤더가 없으면 구버전으로 간주한다. 명세가 정한 기본값이다.
 * 초기화 요청에는 헤더가 없는 것이 정상이다.
 */
export function protocolVersionError(request: Request): string | null {
  const version = request.headers.get("mcp-protocol-version");
  if (!version) return null;

  if (!SUPPORTED_PROTOCOL_VERSIONS.includes(version as never)) {
    return `지원하지 않는 프로토콜 버전입니다: ${version}. 지원 범위: ${SUPPORTED_PROTOCOL_VERSIONS.join(", ")}`;
  }

  return null;
}

/**
 * Origin 검증 — DNS 재바인딩 방어
 *
 * 명세가 MUST로 요구한다. 공격 시나리오는 이렇다. 사용자가 악성 웹페이지를
 * 열면, 그 페이지의 스크립트가 우리 MCP 엔드포인트로 요청을 보낼 수 있다.
 * 토큰이 없으면 401에서 막히지만, 브라우저가 자격 증명을 붙이는 상황이라면
 * 그 방어가 무너진다.
 *
 * Claude Code 같은 비브라우저 클라이언트는 Origin을 보내지 않는다. 그래서
 * "있으면 검사하고 없으면 통과"가 맞다. 없다고 막으면 정상 클라이언트가
 * 전부 거부된다.
 */
export function originError(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  let hostname: string;

  try {
    hostname = new URL(origin).hostname;
  } catch {
    return `Origin 형식이 올바르지 않습니다: ${origin}`;
  }

  // 우리 자신은 언제나 허용한다. 터널 도메인으로 들어온 요청이 그 도메인을
  // Origin으로 달고 오는데, 목록에 없다고 막으면 정작 공개 주소에서만
  // 연결이 실패한다.
  const self = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (self && hostname === self.split(":")[0]) return null;

  if (allowedOrigins().includes(hostname)) return null;

  return `허용되지 않은 Origin입니다: ${origin}`;
}

function allowedOrigins(): string[] {
  const configured = process.env.MCP_ALLOWED_ORIGINS;

  const extra = configured
    ? configured.split(",").map((entry) => entry.trim()).filter(Boolean)
    : [];

  return ["localhost", "127.0.0.1", "[::1]", ...extra];
}
