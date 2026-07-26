import type {
  AiProposalDraft,
  AiRunRequest,
  DocumentBlock,
} from "../contracts/ai";

/**
 * AI Gateway — 아키텍처 §12
 *
 * 모든 모델 호출은 이 인터페이스를 거친다. 호출하는 쪽은 어떤 공급자가
 * 뒤에 있는지 모른다. 그래서 목·Anthropic·OpenAI 호환 서버를 바꿔 끼워도
 * API 라우트와 UI는 손대지 않는다.
 *
 * 인터페이스에 공급자 고유 개념(thinking, effort, response_format …)을
 * 올리지 않는다. 그런 것이 새어 나오는 순간 경계가 무너진다.
 */

export interface AiAdapter {
  /** UI에 표시할 이름. 예: "Study AI · 기본 모델". */
  readonly label: string;

  /** 답변을 조각으로 흘려보낸다. UI 명세 §13의 점진 출력. */
  answer(request: AiRunRequest, signal?: AbortSignal): AsyncIterable<string>;

  /** 구조화된 수정 제안을 만든다. 문자열 전체를 돌려주지 않는다(§14). */
  propose(request: AiRunRequest, signal?: AbortSignal): Promise<AiProposalDraft>;
}

/**
 * 모델에게 문서를 보여주는 형식.
 *
 * blockId를 함께 실어야 모델이 대상 블록을 지목할 수 있다. 이게 없으면
 * 제안은 "문서 끝에 붙이기"밖에 못 한다.
 */
export function renderBlocks(blocks: DocumentBlock[]): string {
  if (!blocks.length) return "(문서가 비어 있습니다.)";

  return blocks
    .map((block) => `[${block.blockId}] (${block.type}) ${block.text}`)
    .join("\n");
}

export const PROPOSAL_SYSTEM_PROMPT = `당신은 공동 학습 문서를 다듬는 보조자입니다.

문서는 블록 목록으로 주어집니다. 각 줄은 [blockId] (블록종류) 본문 형식입니다.

규칙:
- 반드시 주어진 blockId 중 하나를 지목하세요. 새 ID를 만들지 마세요.
- 한 번에 3개 이하의 operation만 제안하세요.
- 각 operation에는 왜 그렇게 바꾸는지 reason을 한국어 한 문장으로 쓰세요.
- 사용자가 요청하지 않은 대량 삭제는 제안하지 마세요.
- 문서에 없는 사실을 지어내지 마세요.`;

export const ANSWER_SYSTEM_PROMPT = `당신은 공동 학습 문서를 돕는 보조자입니다.

주어진 문서 내용만을 근거로 한국어로 답하세요. 문서에 없는 내용은 모른다고
말하세요. 답변은 간결하게, 3~5문장 정도로 쓰세요.`;

/** 지연 시간을 흉내 내지 않고 실제로 조각을 흘려보내기 위한 도우미. */
export async function* chunkText(
  text: string,
  size = 12,
): AsyncIterable<string> {
  for (let index = 0; index < text.length; index += size) {
    yield text.slice(index, index + size);
  }
}
