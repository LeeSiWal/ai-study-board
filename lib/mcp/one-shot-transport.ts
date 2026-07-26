import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * 요청 하나를 처리하고 끝나는 전송 계층.
 *
 * MCP SDK의 기본 전송은 Node의 http 요청·응답 객체를 기대하는데, Next의
 * 라우트 핸들러는 Web Request·Response를 다룬다. 그 사이를 억지로 맞추기보다
 * 얇은 전송을 하나 만들어 SDK의 프로토콜 처리(초기화 협상, 도구 목록,
 * 오류 형식)를 그대로 쓴다.
 *
 * 상태를 두지 않으므로 요청마다 서버를 새로 만든다. 도구만 노출하는
 * 서버라 세션에 남길 상태가 없다.
 */
export class OneShotTransport implements Transport {
  onmessage?: (message: JSONRPCMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  private outgoing: JSONRPCMessage[] = [];
  private notify: (() => void) | null = null;

  async start(): Promise<void> {}

  async send(message: JSONRPCMessage): Promise<void> {
    this.outgoing.push(message);
    this.notify?.();
  }

  async close(): Promise<void> {
    this.onclose?.();
  }

  /**
   * 메시지 하나를 넣고 응답을 받는다.
   *
   * 알림(id 없음)에는 응답이 없으므로 null을 돌려준다. JSON-RPC에서 알림에
   * 응답을 보내면 프로토콜 위반이다.
   */
  async handle(
    message: JSONRPCMessage,
    timeoutMs = 15_000,
  ): Promise<JSONRPCMessage | null> {
    const expectsResponse = "id" in message && message.id !== undefined;

    const settled = new Promise<void>((resolve) => {
      this.notify = resolve;
    });

    this.onmessage?.(message);

    if (!expectsResponse) return null;

    await Promise.race([
      settled,
      new Promise<void>((_, reject) =>
        setTimeout(() => reject(new Error("MCP 응답 시간 초과")), timeoutMs),
      ),
    ]);

    return this.outgoing.shift() ?? null;
  }
}
