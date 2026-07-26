import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { NextResponse } from "next/server";

import { OneShotTransport } from "@/lib/mcp/one-shot-transport";
import { buildMcpServer } from "@/lib/mcp/server";
import { authenticateToken, bearerToken } from "@/lib/mcp/tokens";

/**
 * POST /api/mcp — 들어오는 MCP (아키텍처 §15.4)
 *
 * Claude Desktop, Claude Code 같은 MCP 클라이언트가 이 워크스페이스에 붙는
 * 지점이다. Streamable HTTP의 POST 경로만 구현한다. 도구만 노출하고 서버가
 * 먼저 말을 걸 일이 없어서 SSE 스트림이 필요 없다.
 *
 * 인증은 `Authorization: Bearer <토큰>`이다. MCP 클라이언트는 브라우저
 * 세션 쿠키를 쓸 수 없다.
 */

// 협업 서버에 WebSocket으로 붙어 문서를 읽으므로 Node 런타임이 필요하다.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = bearerToken(request);

  if (!token) {
    return unauthorized("Authorization 헤더에 Bearer 토큰이 필요합니다.");
  }

  const authenticated = await authenticateToken(token);

  if (!authenticated) {
    return unauthorized("토큰이 유효하지 않습니다.");
  }

  let message: JSONRPCMessage;

  try {
    message = (await request.json()) as JSONRPCMessage;
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const server = buildMcpServer({
    user: authenticated.user,
    workspaceId: authenticated.record.workspaceId,
    clientLabel: authenticated.record.name,
  });

  const transport = new OneShotTransport();

  try {
    await server.connect(transport);
    const response = await transport.handle(message);

    // 알림에는 응답하지 않는다. JSON-RPC에서 알림에 응답하면 위반이다.
    if (!response) return new Response(null, { status: 202 });

    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류입니다.";

    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: "id" in message ? message.id : null,
        error: { code: -32603, message: detail },
      },
      { status: 500 },
    );
  } finally {
    await server.close().catch(() => {});
  }
}

function unauthorized(detail: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: detail } },
    {
      status: 401,
      // MCP 클라이언트가 인증 방식을 알아채도록 표준 헤더를 준다.
      headers: { "www-authenticate": 'Bearer realm="ai-study-board"' },
    },
  );
}
