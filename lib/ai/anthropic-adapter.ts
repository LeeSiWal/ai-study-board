import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";

import {
  aiProposalDraftSchema,
  type AiProposalDraft,
  type AiRunRequest,
} from "../contracts/ai";
import {
  ANSWER_SYSTEM_PROMPT,
  PROPOSAL_SYSTEM_PROMPT,
  renderBlocks,
  type AiAdapter,
} from "./gateway";

/**
 * Anthropic 어댑터.
 *
 * 제안은 구조화 출력으로 받는다. 자유 텍스트를 파싱하면 모델이 형식을 조금만
 * 어겨도 전체가 무너지는데, `output_config.format`은 스키마를 API 층에서
 * 강제하므로 그 실패 경로가 사라진다.
 */
export class AnthropicAdapter implements AiAdapter {
  readonly label: string;

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model = "claude-opus-4-8") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
    this.label = `Study AI · ${model}`;
  }

  async *answer(
    request: AiRunRequest,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const stream = this.client.messages.stream(
      {
        model: this.model,
        max_tokens: 2048,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: ANSWER_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `문서:\n${renderBlocks(request.blocks)}\n\n질문: ${request.prompt}`,
          },
        ],
      },
      { signal },
    );

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        yield event.delta.text;
      }
    }
  }

  async propose(
    request: AiRunRequest,
    signal?: AbortSignal,
  ): Promise<AiProposalDraft> {
    const response = await this.client.messages.parse(
      {
        model: this.model,
        max_tokens: 4096,
        thinking: { type: "adaptive" },
        output_config: {
          effort: "high",
          format: zodOutputFormat(aiProposalDraftSchema),
        },
        system: PROPOSAL_SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `문서:\n${renderBlocks(request.blocks)}\n\n요청: ${request.prompt}`,
          },
        ],
      },
      { signal },
    );

    if (!response.parsed_output) {
      throw new Error("모델이 형식에 맞는 제안을 만들지 못했습니다.");
    }

    return response.parsed_output;
  }
}
