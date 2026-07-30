/**
 * redirect_uri 검증
 *
 * 인가 코드가 배달되는 주소다. 여기가 느슨하면 나머지 방어가 다 무의미해진다.
 * 공격자가 자기 주소를 등록해 코드를 받아 가면 PKCE도 소용없다 — 코드를
 * 만든 것이 공격자 자신이기 때문이다.
 *
 * 그래서 등록 단계에서 한 번, 인가 단계에서 등록된 것과 정확히 같은지 또
 * 한 번 본다.
 */

export type RedirectUriCheck = { ok: true } | { ok: false; reason: string };

export function checkRedirectUri(value: string): RedirectUriCheck {
  let url: URL;

  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: `절대 URI가 아닙니다: ${value}` };
  }

  // 프래그먼트는 리다이렉트에서 잘려 나가 비교가 어긋난다. OAuth 2.1이 금지한다.
  if (url.hash) {
    return { ok: false, reason: "redirect_uri에 프래그먼트를 둘 수 없습니다." };
  }

  if (url.protocol === "https:") return { ok: true };

  // 데스크톱 앱이 도는 기기의 루프백은 예외로 허용한다. 네트워크를 타지 않아
  // 평문이어도 가로챌 지점이 없다.
  if (url.protocol === "http:") {
    return isLoopback(url.hostname)
      ? { ok: true }
      : {
          ok: false,
          reason: "http는 루프백 주소에서만 허용됩니다.",
        };
  }

  // claude://… 같은 앱 전용 스킴. 데스크톱 클라이언트가 흔히 쓴다.
  // 스킴에 점이 있어야 한다(역DNS 형태)는 권고까지 강제하지는 않는다 —
  // 실제 클라이언트가 지키지 않으면 붙지 못할 뿐 보안이 나아지지 않는다.
  if (/^[a-z][a-z0-9+.-]*:$/.test(url.protocol)) return { ok: true };

  return { ok: false, reason: `지원하지 않는 스킴입니다: ${url.protocol}` };
}

function isLoopback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]" ||
    hostname === "::1"
  );
}
