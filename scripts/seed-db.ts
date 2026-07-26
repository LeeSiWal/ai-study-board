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

  await db.insert(schema.users).values(SEED_USERS).onConflictDoNothing();
  console.log(`  사용자 ${SEED_USERS.length}명`);

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

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n시드 실패:", error instanceof Error ? error.message : error);
    process.exit(1);
  });
