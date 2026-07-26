import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { readContentVersion } from "@/lib/collab/version";
import { resolvePermissions } from "@/lib/store";

/**
 * GET /api/resources/:resourceId/content-version
 *
 * 제안을 적용하기 직전에 현재 버전을 다시 확인하는 데 쓴다.
 * `baseVersion`과 다르면 제안이 만들어진 뒤 문서가 바뀐 것이다(§14).
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

  if (resolvePermissions(resourceId, user.id).length === 0) {
    return NextResponse.json(
      { error: "이 페이지에 접근할 권한이 없습니다." },
      { status: 403 },
    );
  }

  try {
    return NextResponse.json({ version: await readContentVersion(resourceId) });
  } catch {
    return NextResponse.json(
      { error: "협업 서버에서 버전을 읽지 못했습니다." },
      { status: 502 },
    );
  }
}
