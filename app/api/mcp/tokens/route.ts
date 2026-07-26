import { NextResponse } from "next/server";
import { z } from "zod";

import { currentUser } from "@/lib/auth";
import { issueToken, listTokens, revokeToken } from "@/lib/mcp/tokens";

/**
 * MCP 접속 토큰 관리 — 아키텍처 §15.4
 *
 * SET-03 화면이 쓴다. 발급된 원문은 이 응답에서 한 번만 나가고 저장되지
 * 않는다. 다시 보려면 새로 발급해야 한다.
 */

const createSchema = z.object({ name: z.string().min(1).max(60) });

export async function GET() {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  return NextResponse.json({
    tokens: (await listTokens(user.id)).map((record) => ({
      id: record.id,
      name: record.name,
      hint: record.hint,
      createdAt: record.createdAt.toISOString(),
      lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    })),
  });
}

export async function POST(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const parsed = createSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "토큰 이름을 입력해주세요." },
      { status: 400 },
    );
  }

  const { record, token } = await issueToken(user.id, parsed.data.name);

  return NextResponse.json({
    id: record.id,
    name: record.name,
    // 원문은 여기서만 나간다.
    token,
    hint: record.hint,
  });
}

export async function DELETE(request: Request) {
  const user = await currentUser();

  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");

  if (!id || !await revokeToken(user.id, id)) {
    return NextResponse.json(
      { error: "토큰을 찾을 수 없습니다." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
