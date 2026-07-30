import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { NextResponse } from "next/server";

import { originError, protocolVersionError } from "@/lib/mcp/http";
import { OneShotTransport } from "@/lib/mcp/one-shot-transport";
import { buildMcpServer } from "@/lib/mcp/server";
import { authenticateToken, bearerToken } from "@/lib/mcp/tokens";

/**
 * /api/mcp — 들어오는 MCP (아키텍처 §15.4)
 *
 * Claude Desktop, Claude Code 같은 MCP 클라이언트가 이 워크스페이스에 붙는
 * 지점이다. MCP 명세 2025-06-18의 Streamable HTTP 전송을 따른다.
 *
 * POST만 실제로 처리하고 GET은 405를 돌려준다. 명세가 허용하는 선택이다 —
 * 도구만 노출하고 서버가 먼저 말을 걸 일이 없어 SSE 스트림이 필요 없다.
 * 나중에 서버 쪽 알림(예: 제안이 승인됐다)을 보내려면 그때 GET을 연다.
 *
 * 인증은 `Authorization: Bearer <토큰>`이다. MCP 클라이언트는 브라우저
 * 세션 쿠키를 쓸 수 없다.
 */

// 협업 서버에 WebSocket으로 붙어 문서를 읽으므로 Node 런타임이 필요하다.
export const runtime = "nodejs";

export async function POST(request: Request) {
  // 전송 계층 검사가 먼저다. 인증보다 앞에 두어야 토큰 검증에 자원을 쓰기
  // 전에 규약 위반을 걸러낸다.
  const origin = originError(request);
  if (origin) return badRequest(origin, -32600);

  const version = protocolVersionError(request);
  if (version) return badRequest(version, -32600);

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

/**
 * GET — SSE 스트림을 열지 않는다.
 *
 * 명세는 GET에 text/event-stream을 주거나 405를 주라고 한다. 405를 고른다.
 * 서버가 먼저 보낼 메시지가 없기 때문이다. 명시적으로 두는 이유는 프레임워크
 * 기본 405와 달리 왜 그런지 본문으로 설명하기 위해서다.
 */
export async function GET() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32601,
        message:
          "이 서버는 SSE 스트림을 제공하지 않습니다. POST로 요청하세요.",
      },
    },
    { status: 405, headers: { allow: "POST" } },
  );
}

/**
 * DELETE — 세션 종료를 지원하지 않는다.
 *
 * 무상태 서버라 종료할 세션이 없다. 명세가 405를 허용한다.
 */
export async function DELETE() {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id: null,
      error: { code: -32601, message: "세션을 두지 않는 서버입니다." },
    },
    { status: 405, headers: { allow: "POST" } },
  );
}

function badRequest(detail: string, code: number) {
  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code, message: detail } },
    { status: 400 },
  );
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
