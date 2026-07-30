import { compare, hash } from "bcryptjs";

/**
 * 비밀번호 해싱.
 *
 * 시드 사용자를 평문으로 두던 것을 걷어낸다. 프로토타입이라도 가입을 받기
 * 시작하면 사람들이 다른 곳에서 쓰는 비밀번호를 넣는다. 이 서비스가 터널로
 * 외부에 열려 있기도 하다.
 *
 * bcrypt를 쓰는 이유는 의도적으로 느리기 때문이다. 빠른 해시(SHA 등)는
 * 유출됐을 때 초당 수십억 번 시도할 수 있어 소용이 없다.
 */

/** 라운드가 높을수록 느리고 안전하다. 10이 흔한 균형점이다. */
const ROUNDS = 10;

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, ROUNDS);
}

/**
 * 비밀번호를 확인한다.
 *
 * 해시 형식이 아니면 그냥 false를 돌려준다. 평문이 남아 있는 옛 레코드가
 * 우연히 통과하는 일을 막는다.
 */
export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<boolean> {
  if (!stored.startsWith("$2")) return false;

  return compare(plain, stored);
}
