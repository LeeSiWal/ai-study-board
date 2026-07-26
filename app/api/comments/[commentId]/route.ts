import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { updateCommentSchema } from "@/lib/contracts/comments";
import { resolvePermissions } from "@/lib/store";
import { findComment, setCommentResolved } from "@/lib/store/comments";

/**
 * PATCH /api/comments/:commentId — 해결 또는 재열기
 *
 * 누구든 댓글을 달 수 있는 사람이면 해결할 수 있다. 해결은 파괴적이지 않고
 * 되돌릴 수 있어서(§12) 작성자만으로 제한할 이유가 없다.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ commentId: string }> },
) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { commentId } = await params;
  const comment = await findComment(commentId);

  if (!comment) {
    return NextResponse.json(
      { error: "댓글을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  if (!(await resolvePermissions(comment.resourceId, user.id)).includes("comment")) {
    return NextResponse.json(
      { error: "이 댓글을 바꿀 권한이 없습니다." },
      { status: 403 },
    );
  }

  const parsed = updateCommentSchema.safeParse(
    await request.json().catch(() => null),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 },
    );
  }

  const updated = await setCommentResolved(
    commentId,
    parsed.data.action === "resolve",
  );

  if (!updated) {
    return NextResponse.json(
      { error: "답글은 따로 해결할 수 없습니다." },
      { status: 400 },
    );
  }

  return NextResponse.json({ comment: updated });
}
