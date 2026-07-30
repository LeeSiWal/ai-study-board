import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";
import { NextResponse } from "next/server";

import { logMcp, requestFacts } from "@/lib/mcp/access-log";
import { authenticateMcpRequest } from "@/lib/mcp/authenticate";
import { originError, protocolVersionError } from "@/lib/mcp/http";
import { OneShotTransport } from "@/lib/mcp/one-shot-transport";
import { buildMcpServer } from "@/lib/mcp/server";
import { bearerToken } from "@/lib/mcp/tokens";
import { canonicalResource, requestOrigin } from "@/lib/oauth/core";

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
  const facts = requestFacts(request);

  // 전송 계층 검사가 먼저다. 인증보다 앞에 두어야 토큰 검증에 자원을 쓰기
  // 전에 규약 위반을 걸러낸다.
  const origin = originError(request);

  if (origin) {
    logMcp({ ...facts, outcome: `400 ${origin}` });
    return badRequest(origin, -32600);
  }

  const version = protocolVersionError(request);

  if (version) {
    logMcp({ ...facts, outcome: `400 ${version}` });
    return badRequest(version, -32600);
  }

  const origin_ = requestOrigin(request);
  const token = bearerToken(request);

  if (!token) {
    logMcp({ ...facts, outcome: "401 토큰 없음" });
    return unauthorized(
      origin_,
      "Authorization 헤더에 Bearer 토큰이 필요합니다.",
    );
  }

  const identity = await authenticateMcpRequest(
    token,
    canonicalResource(origin_),
  );

  if (!identity) {
    logMcp({ ...facts, outcome: "401 토큰 무효" });
    return unauthorized(origin_, "토큰이 유효하지 않거나 만료되었습니다.");
  }

  let message: JSONRPCMessage;

  try {
    message = (await request.json()) as JSONRPCMessage;
  } catch {
    logMcp({ ...facts, outcome: "400 본문 파싱 실패" });
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  const method = "method" in message ? message.method : undefined;
  const server = buildMcpServer(identity);

  const transport = new OneShotTransport();

  try {
    await server.connect(transport);
    const response = await transport.handle(message);

    // 알림에는 응답하지 않는다. JSON-RPC에서 알림에 응답하면 위반이다.
    if (!response) {
      logMcp({ ...facts, method, outcome: "202 알림" });
      return new Response(null, { status: 202 });
    }

    logMcp({
      ...facts,
      method,
      // 툴 개수를 함께 남긴다. "불렀는데 0개"와 "부르지도 않았다"는 원인이
      // 전혀 다른데, 밖에서는 둘 다 똑같이 "툴 없음"으로 보인다.
      outcome:
        "result" in response && response.result
          ? `200 ${summarize(response.result)}`
          : `200 ${JSON.stringify(response).slice(0, 200)}`,
    });

    return NextResponse.json(response);
  } catch (error) {
    const detail =
      error instanceof Error ? error.message : "알 수 없는 오류입니다.";

    logMcp({ ...facts, method, outcome: `500 ${detail}` });

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

function summarize(result: unknown): string {
  if (result && typeof result === "object" && "tools" in result) {
    const { tools } = result as { tools: unknown[] };
    return `툴 ${tools.length}개`;
  }

  return JSON.stringify(result).slice(0, 200);
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

/**
 * 401은 OAuth 흐름의 출발점이다.
 *
 * MCP 인가 명세는 401에 `resource_metadata`를 실으라고 MUST로 요구한다.
 * 클라이언트는 이 주소 하나로 인가 서버를 찾아 등록·인가·발급을 스스로
 * 진행한다. 이 파라미터가 빠지면 클라이언트는 어디로 가야 할지 몰라
 * "인증 실패"만 보여주고 멈춘다.
 */
function unauthorized(origin: string, detail: string) {
  const metadata = `${origin}/.well-known/oauth-protected-resource/api/mcp`;

  return NextResponse.json(
    { jsonrpc: "2.0", id: null, error: { code: -32001, message: detail } },
    {
      status: 401,
      headers: {
        "www-authenticate": `Bearer realm="ai-study-board", resource_metadata="${metadata}"`,
      },
    },
  );
}
