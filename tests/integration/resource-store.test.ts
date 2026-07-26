// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  findResourceById,
  resolvePermissions,
  updateResourceTitle,
} from "@/lib/store";

/**
 * 데이터베이스가 필요한 테스트다.
 *
 * 단위 테스트(`npm test`)는 브라우저 환경에서 순수 로직만 돌린다. 여기는
 * 실제 PostgreSQL에 붙으므로 `npm run db:up`과 `npm run db:seed`가 먼저다.
 * 둘을 섞으면 단위 테스트가 인프라에 묶여 느려지고 잘 깨진다.
 */

describe("리소스 메타데이터", () => {
  it("문서 제목을 갱신하되 문서 본문과 분리한다", async () => {
    const resourceId = "res-self-attention";
    const original = (await findResourceById(resourceId))?.title;

    expect((await updateResourceTitle(resourceId, "변경된 제목"))?.title).toBe(
      "변경된 제목",
    );
    expect((await findResourceById(resourceId))?.title).toBe("변경된 제목");

    if (original) await updateResourceTitle(resourceId, original);
  });

  it("GUEST에게 제목 편집 권한을 주지 않는다", async () => {
    expect(
      await resolvePermissions("res-self-attention", "user-soyeon"),
    ).not.toContain("edit");
  });
});
