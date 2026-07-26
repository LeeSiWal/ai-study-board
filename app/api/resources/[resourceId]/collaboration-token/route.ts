import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { signCollaborationToken } from "@/lib/collab/token";
import {
  COLLABORATION_TOKEN_TTL_SECONDS,
  documentNameForResource,
} from "@/lib/contracts/collaboration";
import { findResourceById, resolvePermissions } from "@/lib/store";

/**
 * POST /api/resources/:resourceId/collaboration-token
 *
 * 아키텍처 §17의 단기 협업 토큰 발급. 권한 판정은 여기서 한 번만 하고,
 * 협업 서버는 서명된 결과만 신뢰한다.
 */
export async function POST(
  _request: Request,
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

  const permissions = await resolvePermissions(resourceId, user.id);

  if (permissions.length === 0) {
    return NextResponse.json(
      { error: "이 페이지에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  const token = await signCollaborationToken({
    userId: user.id,
    displayName: user.displayName,
    cursorColor: user.cursorColor,
    workspaceId: resource.workspaceId,
    resourceId,
    permissions,
  });

  return NextResponse.json({
    token,
    documentName: documentNameForResource(resourceId),
    expiresInSeconds: COLLABORATION_TOKEN_TTL_SECONDS,
    permissions,
  });
}
