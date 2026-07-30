import { NextResponse } from "next/server";

import {
  metadataPreflight,
  metadataResponse,
  protectedResourceMetadata,
} from "@/lib/oauth/metadata";

/**
 * GET /.well-known/oauth-protected-resource[/api/mcp] — RFC 9728
 *
 * RFC 9728은 리소스 경로를 well-known 뒤에 끼워 넣는다. `/api/mcp`를 지키는
 * 문서의 정식 위치는 `/.well-known/oauth-protected-resource/api/mcp`다.
 *
 * 그런데 루트 경로만 찔러 보는 클라이언트도 있다. 선택 catch-all로 둘 다
 * 받는다. 문서가 하나뿐이라 어느 쪽으로 와도 같은 답이면 된다.
 *
 * 다른 경로는 404다. 아무 경로에나 같은 문서를 주면 클라이언트가 지키지도
 * 않는 리소스를 지킨다고 믿는다.
 */
export const runtime = "nodejs";

const KNOWN_PATHS = new Set(["", "api/mcp"]);

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  const { path } = await params;

  if (!KNOWN_PATHS.has((path ?? []).join("/"))) {
    return NextResponse.json(
      { error: "이 경로를 지키는 리소스가 없습니다." },
      { status: 404 },
    );
  }

  return metadataResponse(protectedResourceMetadata(request));
}

export async function OPTIONS() {
  return metadataPreflight();
}
