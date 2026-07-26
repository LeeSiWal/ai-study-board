import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { createCommentSchema } from "@/lib/contracts/comments";
import { resolvePermissions } from "@/lib/store";
import { createComment, listComments } from "@/lib/store/comments";

/**
 * GET/POST /api/resources/:resourceId/comments — 아키텍처 §21
 *
 * 읽기는 view 권한, 쓰기는 comment 권한이 필요하다(§17). GUEST도 댓글은
 * 달 수 있다는 것이 역할 설계의 의도다.
 */

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { resourceId } = await params;

  if ((await resolvePermissions(resourceId, user.id)).length === 0) {
    return NextResponse.json(
      { error: "이 페이지에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  return NextResponse.json({ comments: await listComments(resourceId) });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ resourceId: string }> },
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { resourceId } = await params;

  if (!(await resolvePermissions(resourceId, user.id)).includes("comment")) {
    return NextResponse.json(
      { error: "이 페이지에 댓글을 달 권한이 없습니다." },
      { status: 403 },
    );
  }

  const parsed = createCommentSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "댓글 내용을 확인해주세요." },
      { status: 400 },
    );
  }

  const comment = await createComment(resourceId, user, parsed.data);
  return NextResponse.json({ comment });
}
