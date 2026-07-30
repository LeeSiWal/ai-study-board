/**
 * 로그인 후 돌아갈 경로를 안전하게 좁힌다.
 *
 * 이 값은 쿼리스트링으로 들어온다. 그대로 리다이렉트에 쓰면 공격자가
 * `?next=https://악성.example.com`을 붙인 링크를 뿌려 우리 도메인을 빌린
 * 피싱을 만든다. 사용자는 study.19921005.xyz를 보고 눌렀는데 남의 로그인
 * 화면에 도착한다.
 *
 * 같은 출처의 경로만 통과시킨다. `//evil.com`은 브라우저가 스킴 상대 URL로
 * 읽어 외부로 나가므로 함께 막는다.
 */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string" || !value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;

  return value;
}
