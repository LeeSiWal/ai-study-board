/**
 * UUID 생성.
 *
 * `crypto.randomUUID()`는 보안 컨텍스트(HTTPS 또는 localhost)에서만 존재한다.
 * 개발 서버를 LAN IP로 열면 — 다른 기기에서 테스트할 때 흔하다 — 이 함수가
 * 없어서 호출이 그대로 터진다.
 *
 * 편집기의 blockId 부여는 매 트랜잭션마다 돌기 때문에, 여기서 던지면 입력이
 * 통째로 실패한다. 화면에는 글자가 보이지 않고 서버에도 아무것도 도착하지
 * 않는다. 그래서 보안 컨텍스트가 아닐 때도 동작하는 경로를 둔다.
 *
 * `crypto.getRandomValues`는 보안 컨텍스트가 아니어도 쓸 수 있다.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = crypto.getRandomValues(new Uint8Array(16));

    // RFC 4122 버전 4, variant 10xx.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");

    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20),
    ].join("-");
  }

  throw new Error("이 환경에서는 안전한 ID를 만들 수 없습니다.");
}
