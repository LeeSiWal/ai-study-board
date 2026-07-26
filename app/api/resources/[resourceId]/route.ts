import { NextResponse } from "next/server";
import { z } from "zod";

import { currentUser } from "@/lib/auth";
import {
  findResourceById,
  resolvePermissions,
  updateResourceTitle,
} from "@/lib/store";

const updateResourceSchema = z.object({
  title: z.string().trim().min(1, "제목을 입력해 주세요.").max(120),
});

/** 문서 제목 같은 일반 메타데이터만 갱신한다. 본문은 CRDT 경계에 남는다. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { resourceId } = await params;
  const resource = await findResourceById(resourceId);
  if (!resource) {
    return NextResponse.json(
      { error: "리소스를 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!(await resolvePermissions(resourceId, user.id)).includes("edit")) {
    return NextResponse.json(
      { error: "제목을 편집할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = updateResourceSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "제목을 확인해 주세요." },
      { status: 400 },
    );
  }

  const updated = await updateResourceTitle(resourceId, parsed.data.title);
  return NextResponse.json({ title: updated?.title });
}
