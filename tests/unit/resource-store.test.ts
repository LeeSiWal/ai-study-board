import { describe, expect, it } from "vitest";

import {
  findResourceById,
  resolvePermissions,
  updateResourceTitle,
} from "@/lib/store";

describe("리소스 메타데이터", () => {
  it("문서 제목을 갱신하되 문서 본문과 분리한다", () => {
    const resourceId = "res-self-attention";
    const original = findResourceById(resourceId)?.title;

    expect(updateResourceTitle(resourceId, "변경된 제목")?.title).toBe(
      "변경된 제목",
    );
    expect(findResourceById(resourceId)?.title).toBe("변경된 제목");

    if (original) updateResourceTitle(resourceId, original);
  });

  it("GUEST에게 제목 편집 권한을 주지 않는다", () => {
    expect(
      resolvePermissions("res-self-attention", "user-soyeon"),
    ).not.toContain("edit");
  });
});
