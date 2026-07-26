import { AnthropicAdapter } from "./anthropic-adapter";
import type { AiAdapter } from "./gateway";
import { MockAdapter } from "./mock-adapter";
import { OpenAiAdapter } from "./openai-adapter";

export type { AiAdapter } from "./gateway";

/**
 * 어댑터 선택 — 아키텍처 §12의 Model Router 자리.
 *
 * 지금은 환경변수만 본다. 사용자별 연결(`ai_connections`)이 들어오면 이
 * 함수가 소유자와 기본 모델을 조회해 고르도록 확장한다. 호출하는 쪽은
 * `AiAdapter`만 알기 때문에 바뀌지 않는다.
 *
 * 키를 여기서 읽고 어댑터 안에서만 쓴다. 복호화와 사용은 게이트웨이 내부에
 * 가둔다는 §12의 규칙을 코드 구조로 지킨다.
 */
export function selectAdapter(): AiAdapter {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return new AnthropicAdapter(
      anthropicKey,
      process.env.ANTHROPIC_MODEL ?? undefined,
    );
  }

  const openAiKey = process.env.OPENAI_API_KEY;
  if (openAiKey) {
    return new OpenAiAdapter(
      openAiKey,
      process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      // 로컬 서버를 붙일 때만 설정한다. 예: http://127.0.0.1:11434/v1
      process.env.OPENAI_BASE_URL ?? undefined,
    );
  }

  return new MockAdapter();
}
