import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { resolvePermissions } from "@/lib/store";
import { listPendingProposals } from "@/lib/store/proposals";

/**
 * GET /api/resources/:resourceId/proposals — 아키텍처 §21
 *
 * 대기 중인 제안만 돌려준다. 워크스페이스 AI가 만든 것과 외부 MCP
 * 클라이언트가 만든 것이 섞여 있고, `origin`으로 구분한다.
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

  return NextResponse.json({ proposals: await listPendingProposals(resourceId) });
}
