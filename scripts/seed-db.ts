import { eq } from "drizzle-orm";

import { hashPassword } from "../lib/auth/password";
import { db, schema } from "../lib/db";
import {
  SEED_DOCUMENTS,
  SEED_MEMBERS,
  SEED_RESOURCES,
  SEED_USERS,
  SEED_WORKSPACE,
} from "../lib/store/seed";

/**
 * 시드 데이터를 넣는다 — UI 명세 §28
 *
 * 여러 번 돌려도 안전하다. 이미 있으면 건드리지 않는다. 개발 중에 스키마를
 * 바꾸고 다시 돌리는 일이 잦은데, 그때마다 사람이 쓴 문서까지 지워지면
 * 곤란하다.
 *
 * 문서 **본문**은 넣지 않는다. 본문은 CRDT에 있고 협업 서버가 소유한다(§3.1).
 * 여기서 채우면 출처가 둘이 된다.
 */
async function main() {
  console.log("시드 데이터를 넣습니다…\n");

  // 비밀번호는 해시로 넣는다. 시드도 예외를 두지 않는다.
  const users = await Promise.all(
    SEED_USERS.map(async (user) => ({
      ...user,
      password: await hashPassword(user.password),
    })),
  );

  await db.insert(schema.users).values(users).onConflictDoNothing();
  console.log(`  사용자 ${users.length}명 (비밀번호 해시)`);

  // 해싱을 도입하기 전에 평문으로 저장된 레코드가 남아 있다. 그대로 두면
  // 로그인이 깨지므로 여기서 올려 준다. onConflictDoNothing은 기존 행을
  // 건드리지 않기 때문에 별도 단계가 필요하다.
  const upgraded = await upgradePlaintextPasswords();
  if (upgraded) console.log(`  평문 비밀번호 ${upgraded}건을 해시로 올림`);

  await db
    .insert(schema.workspaces)
    .values(SEED_WORKSPACE)
    .onConflictDoNothing();
  console.log(`  워크스페이스 ${SEED_WORKSPACE.name}`);

  await db
    .insert(schema.workspaceMembers)
    .values(SEED_MEMBERS)
    .onConflictDoNothing();
  console.log(`  멤버 ${SEED_MEMBERS.length}명`);

  // 리소스는 부모를 참조하므로 순서가 중요하다. 시드 배열이 이미 부모 →
  // 자식 순이라 그대로 넣는다.
  await db.insert(schema.resources).values(SEED_RESOURCES).onConflictDoNothing();
  console.log(`  리소스 ${SEED_RESOURCES.length}개`);

  await db
    .insert(schema.documents)
    .values(SEED_DOCUMENTS)
    .onConflictDoNothing();
  console.log(`  문서 메타데이터 ${SEED_DOCUMENTS.length}개`);

  console.log("\n완료. 로그인 비밀번호는 모두 study1234 입니다.");
}

/** bcrypt 해시는 $2로 시작한다. 그렇지 않은 값은 평문이다. */
async function upgradePlaintextPasswords(): Promise<number> {
  const rows = await db.select().from(schema.users);
  const plaintext = rows.filter((row) => !row.password.startsWith("$2"));

  for (const row of plaintext) {
    await db
      .update(schema.users)
      .set({ password: await hashPassword(row.password) })
      .where(eq(schema.users.id, row.id));
  }

  return plaintext.length;
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n시드 실패:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
