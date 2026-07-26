import type { AiProposalDraft, AiRunRequest } from "../contracts/ai";
import { chunkText, type AiAdapter } from "./gateway";

/**
 * 목 어댑터.
 *
 * API 키 없이 전체 흐름을 시연한다. 무엇보다 UI 명세 §28이 요구하는
 * 결정적 재현 — "문장 개선 제안 3개, 1개는 충돌 상태" — 은 진짜 모델로는
 * 안정적으로 만들 수 없다.
 *
 * 답변은 문서 내용에서 실제로 뽑아 쓴다. 하드코딩된 문장을 돌려주면
 * 문서를 바꿔도 답이 그대로라 시연이 거짓말이 된다.
 */
export class MockAdapter implements AiAdapter {
  readonly label = "Study AI · 목 모델";

  async *answer(request: AiRunRequest): AsyncIterable<string> {
    const blocks = request.blocks.filter((block) => block.text.trim());

    const body = blocks.length
      ? [
          `문서에는 ${blocks.length}개의 블록이 있습니다.`,
          `첫 문단은 "${truncate(blocks[0].text, 40)}"로 시작합니다.`,
          `"${truncate(request.prompt, 30)}"에 대해서는 이 문서의 내용을 근거로 답해야 합니다.`,
          `실제 모델을 붙이려면 ANTHROPIC_API_KEY 또는 OPENAI_API_KEY를 설정하세요.`,
        ].join(" ")
      : "문서가 비어 있어 답변할 근거가 없습니다. 내용을 먼저 작성해 주세요.";

    yield* chunkText(body);
  }

  async propose(request: AiRunRequest): Promise<AiProposalDraft> {
    const candidates = request.blocks
      .filter((block) => block.text.trim().length > 0)
      .slice(0, 2);

    if (!candidates.length) {
      return {
        summary: "문서가 비어 있어 제안할 내용이 없습니다.",
        operations: [],
      };
    }

    // 첫 블록은 다듬고, 그 뒤에 요약을 하나 덧붙인다.
    // 실제 blockId를 지목하므로 적용 경로가 진짜로 검증된다.
    return {
      summary: `${candidates.length}개 블록에 대한 제안입니다.`,
      operations: [
        {
          type: "replace_block",
          blockId: candidates[0].blockId,
          content: `${candidates[0].text.trim()} (다듬은 문장)`,
          reason: "문장을 더 명확하게 다듬었습니다.",
        },
        {
          type: "insert_after",
          blockId: candidates[candidates.length - 1].blockId,
          content: `요약: ${truncate(candidates.map((b) => b.text).join(" "), 60)}`,
          reason: "문단 아래에 요약을 덧붙였습니다.",
        },
      ],
    };
  }
}

function truncate(text: string, length: number): string {
  const trimmed = text.trim();
  return trimmed.length <= length ? trimmed : `${trimmed.slice(0, length)}…`;
}
