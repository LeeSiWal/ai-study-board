#!/usr/bin/env node
import { createInterface } from "node:readline";

/**
 * Claude Desktop을 위한 stdio 브리지 — 아키텍처 §15.4
 *
 * Claude Desktop은 원격 MCP 서버에 붙을 때 OAuth 흐름을 탄다. Bearer 토큰을
 * 직접 넣을 자리가 없다. OAuth 인가 서버를 세우는 것은 별개의 큰 작업이라,
 * 그 사이를 이 브리지가 메운다.
 *
 * Claude Desktop이 이 프로세스를 자식으로 띄우고 stdio로 대화한다. 브리지는
 * 받은 JSON-RPC를 그대로 우리 HTTP 엔드포인트로 넘기고 답을 돌려준다.
 * 프로토콜을 해석하지 않으므로 도구가 늘어도 이 파일은 그대로다.
 *
 * 토큰은 환경변수로 받는다. MCP 명세도 stdio 전송에서는 자격 증명을 환경에서
 * 가져오라고 한다(인가 명세 §Protocol Requirements).
 *
 * 설정 예시는 설정 → MCP 연결 화면에서 복사할 수 있다.
 */

const url = process.env.AI_STUDY_MCP_URL;
const token = process.env.AI_STUDY_MCP_TOKEN;

if (!url || !token) {
  process.stderr.write(
    "AI_STUDY_MCP_URL과 AI_STUDY_MCP_TOKEN 환경변수가 필요합니다.\n" +
      "설정 → MCP 연결에서 토큰을 발급하고 설정을 복사하세요.\n",
  );
  process.exit(1);
}

/** stdout에는 MCP 메시지만 쓴다. 로그는 전부 stderr로 보낸다. */
function log(message: string) {
  process.stderr.write(`[bridge] ${message}\n`);
}

function send(message: unknown) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

async function forward(raw: string) {
  let message: { id?: unknown; method?: unknown };

  try {
    message = JSON.parse(raw);
  } catch {
    log(`JSON이 아닌 줄을 무시합니다: ${raw.slice(0, 80)}`);
    return;
  }

  // 알림에는 id가 없고 응답도 없다. 그래도 서버에는 전달해야 한다.
  const expectsResponse = "id" in message && message.id !== undefined;

  try {
    const response = await fetch(url!, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
        authorization: `Bearer ${token}`,
      },
      body: raw,
    });

    if (response.status === 202) return;

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      log(`HTTP ${response.status} ${detail.slice(0, 200)}`);

      if (expectsResponse) {
        send({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32603,
            message: `서버가 ${response.status}를 돌려줬습니다. 토큰이 유효한지 확인하세요.`,
          },
        });
      }
      return;
    }

    const body = await response.json();
    if (expectsResponse) send(body);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log(`전달 실패: ${detail}`);

    if (expectsResponse) {
      send({
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32603, message: `서버에 연결하지 못했습니다: ${detail}` },
      });
    }
  }
}

/**
 * 줄 단위로 읽는다. stdio 전송의 메시지는 개행으로 구분되고 내부에 개행을
 * 포함하지 않는다.
 *
 * 순차 처리한다. 병렬로 보내면 응답 순서가 뒤섞이는데, 클라이언트가 id로
 * 짝을 맞추더라도 굳이 어지럽힐 이유가 없다.
 */
const reader = createInterface({ input: process.stdin });
let queue: Promise<void> = Promise.resolve();

reader.on("line", (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;

  queue = queue.then(() => forward(trimmed));
});

reader.on("close", () => {
  log("입력이 닫혔습니다. 종료합니다.");
  process.exit(0);
});

log(`${url} 로 연결을 중계합니다.`);
