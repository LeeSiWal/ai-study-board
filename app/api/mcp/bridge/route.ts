import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { NextResponse } from "next/server";

/**
 * GET /api/mcp/bridge — Claude Desktop용 브리지 내려받기
 *
 * Claude Desktop은 대개 이 서버와 다른 컴퓨터에 있다. 저장소를 통째로
 * 복제하게 만들 이유가 없어서 파일 하나만 내려준다.
 *
 * 인증을 두지 않는다. 이 파일에는 비밀이 없고 — 토큰은 사용자가 환경변수로
 * 따로 넣는다 — 설정 안내를 읽는 사람이 바로 받을 수 있어야 한다.
 */
export const runtime = "nodejs";

export async function GET() {
  try {
    const source = await readFile(
      join(process.cwd(), "mcp-bridge", "bridge.mjs"),
      "utf8",
    );

    return new NextResponse(source, {
      headers: {
        "content-type": "text/javascript; charset=utf-8",
        "content-disposition": 'attachment; filename="ai-study-bridge.mjs"',
        "cache-control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "브리지 파일을 찾을 수 없습니다." },
      { status: 404 },
    );
  }
}
