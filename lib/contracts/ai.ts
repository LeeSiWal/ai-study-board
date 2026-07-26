import { z } from "zod";

/**
 * AI 실행 계약 — 아키텍처 §14
 *
 * AI는 문서 전체 문자열을 반환하지 않는다. 어떤 블록을 어떻게 바꿀지
 * 구조화된 operation으로 지목한다. 대상은 `blockId`이고, 이 ID는 편집기의
 * BlockId 확장이 문서에 심어 둔 값이다.
 *
 * 이 스키마는 세 곳이 공유한다. AI 어댑터(생성), API(검증), 편집기(적용).
 */

/** 문서를 AI에게 넘길 때 쓰는 블록 단위. */
export const documentBlockSchema = z.object({
  blockId: z.string().min(1),
  /** paragraph, heading 등 ProseMirror 노드 이름. */
  type: z.string().min(1),
  text: z.string(),
});

export type DocumentBlock = z.infer<typeof documentBlockSchema>;

/**
 * 수정 제안 operation.
 *
 * `reason`을 필수로 둔 이유는 UI 명세 §14가 각 operation 카드에 "변경 이유"를
 * 요구하기 때문이다. 이유 없는 제안은 사용자가 판단할 근거가 없다.
 */
export const aiOperationSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("replace_block"),
    blockId: z.string().min(1),
    content: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("insert_after"),
    blockId: z.string().min(1),
    content: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({
    type: z.literal("delete_block"),
    blockId: z.string().min(1),
    reason: z.string().min(1),
  }),
]);

export type AiOperation = z.infer<typeof aiOperationSchema>;

/** 모델이 돌려주는 구조화 출력. */
export const aiProposalDraftSchema = z.object({
  summary: z.string(),
  operations: z.array(aiOperationSchema),
});

export type AiProposalDraft = z.infer<typeof aiProposalDraftSchema>;

/**
 * 저장·전달되는 제안.
 *
 * `baseVersion`은 제안을 만들 때의 문서 버전이다. 승인 시점에 문서가
 * 그 뒤로 바뀌었는지 판단하는 유일한 기준이다(아키텍처 §14).
 */
export const aiProposalSchema = aiProposalDraftSchema.extend({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  baseVersion: z.number().int().nonnegative(),
  modelLabel: z.string().min(1),
});

export type AiProposal = z.infer<typeof aiProposalSchema>;

/** 답변에 붙는 출처. 없는 출처를 있는 것처럼 만들지 않는다(UI 명세 §13). */
export const aiCitationSchema = z.object({
  label: z.string().min(1),
  blockId: z.string().nullable(),
});

export type AiCitation = z.infer<typeof aiCitationSchema>;

/** `ai_runs`의 작업 종류(아키텍처 §13). */
export const aiOperationTypeSchema = z.enum(["answer", "propose"]);

export type AiOperationType = z.infer<typeof aiOperationTypeSchema>;

export const aiRunRequestSchema = z.object({
  resourceId: z.string().min(1),
  operationType: aiOperationTypeSchema,
  prompt: z.string().min(1).max(4000),
  /** 현재 문서 상태. 본문은 CRDT에 있으므로 클라이언트가 실어 보낸다. */
  blocks: z.array(documentBlockSchema).max(500),
  baseVersion: z.number().int().nonnegative(),
});

export type AiRunRequest = z.infer<typeof aiRunRequestSchema>;
