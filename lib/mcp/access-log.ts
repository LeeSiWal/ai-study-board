import { appendFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * MCP 요청 기록 — 진단용
 *
 * 원격 클라이언트가 왜 툴을 못 받는지는 밖에서 볼 수가 없다. 클라이언트
 * 화면에는 "연결됨"만 뜨고, curl로 재현하면 잘 되고, 그 사이에서 무슨
 * 일이 있었는지는 아무도 모른다. 실제로 Origin 검사에 막혀 있던 것을
 * 그렇게 놓쳤다.
 *
 * 그래서 무엇이 들어와 무엇으로 끝났는지를 남긴다. 개발 환경에서만 돈다.
 *
 * 토큰은 남기지 않는다. 있었는지 없었는지만 적는다. 진단에 필요한 것은
 * 거기까지고, 로그 파일이 자격 증명 저장소가 되면 안 된다.
 */

const ENABLED = process.env.NODE_ENV !== "production";
const FILE = join(process.cwd(), ".mcp-access.log");

export interface McpLogEntry {
  /** JSON-RPC 메서드. 본문을 읽기 전에 끝난 요청은 없다. */
  method?: string;
  origin: string | null;
  protocolVersion: string | null;
  userAgent: string | null;
  hasAuth: boolean;
  /** 이 요청이 어떻게 끝났는지. 실패면 왜인지. */
  outcome: string;
}

export function logMcp(entry: McpLogEntry): void {
  if (!ENABLED) return;

  const line = `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`;

  // 기다리지 않는다. 기록이 실패해도 응답이 늦거나 막히면 안 된다.
  void appendFile(FILE, line).catch(() => {});
}

/** 라우트가 매번 같은 헤더를 꺼내지 않도록 모아 둔다. */
export function requestFacts(request: Request) {
  return {
    origin: request.headers.get("origin"),
    protocolVersion: request.headers.get("mcp-protocol-version"),
    userAgent: request.headers.get("user-agent"),
    hasAuth: !!request.headers.get("authorization"),
  };
}
