import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

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
 * OpenAI 호환 어댑터.
 *
 * 아키텍처 §12의 연결 유형 중 "사용자 지정 OpenAI 호환 서버"를 담당한다.
 * `baseURL`을 바꾸면 OpenAI뿐 아니라 Ollama, vLLM, LM Studio처럼 같은
 * 규약을 따르는 로컬 서버에도 그대로 붙는다.
 *
 * 이 어댑터가 있는 덕에 게이트웨이 인터페이스가 진짜 경계인지 확인된다.
 * 요청 모양이 Anthropic과 달라서, 공급자 고유 개념이 인터페이스로 새어
 * 나왔다면 여기서 컴파일이 깨진다.
 */
export class OpenAiAdapter implements AiAdapter {
  readonly label: string;

  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string, baseURL?: string) {
    this.client = new OpenAI({ apiKey, baseURL });
    this.model = model;
    this.label = `Study AI · ${model}`;
  }

  async *answer(
    request: AiRunRequest,
    signal?: AbortSignal,
  ): AsyncIterable<string> {
    const stream = await this.client.responses.create(
      {
        model: this.model,
        instructions: ANSWER_SYSTEM_PROMPT,
        input: `문서:\n${renderBlocks(request.blocks)}\n\n질문: ${request.prompt}`,
        stream: true,
      },
      { signal },
    );

    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        yield event.delta;
      }
    }
  }

  async propose(
    request: AiRunRequest,
    signal?: AbortSignal,
  ): Promise<AiProposalDraft> {
    const response = await this.client.responses.parse(
      {
        model: this.model,
        instructions: PROPOSAL_SYSTEM_PROMPT,
        input: `문서:\n${renderBlocks(request.blocks)}\n\n요청: ${request.prompt}`,
        text: { format: zodTextFormat(aiProposalDraftSchema, "proposal") },
      },
      { signal },
    );

    if (!response.output_parsed) {
      throw new Error("모델이 형식에 맞는 제안을 만들지 못했습니다.");
    }

    return response.output_parsed;
  }
}
