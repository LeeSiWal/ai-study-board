import { NextResponse } from "next/server";

import { currentUser } from "@/lib/auth";
import { listConnections, revokeConnection } from "@/lib/oauth/core";

/**
 * 연결된 앱 관리 — SET-03이 쓴다.
 *
 * OAuth 엔드포인트와 달리 여기는 브라우저 세션으로 인증한다. 사용자가
 * 자기 화면에서 자기 연결을 보는 것이라, MCP 토큰을 들고 올 이유가 없다.
 */
export const runtime = "nodejs";

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    connections: (await listConnections(user.id)).map((connection) => ({
      clientId: connection.clientId,
      name: connection.name,
      authorizedAt: connection.authorizedAt.toISOString(),
    })),
  });
}

export async function DELETE(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId");

  if (!clientId || !(await revokeConnection(user.id, clientId))) {
    return NextResponse.json(
      { error: "연결을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
