import { z } from "zod";

/**
 * 댓글 계약 — 아키텍처 §18의 `comments`
 *
 * 댓글은 협업 데이터지만 CRDT가 아니라 일반 업무 데이터다(§3.1). 동시 편집
 * 대상이 아니고, 목록·필터·해결 상태처럼 관계형으로 다루는 편이 자연스럽다.
 *
 * `blockId`로 문장에 붙는다. AI 제안과 같은 앵커를 쓰므로 문서를 편집해도
 * 댓글이 대상을 잃지 않는다.
 */

export const commentSchema = z.object({
  id: z.string().min(1),
  resourceId: z.string().min(1),
  /** 답글이면 부모 댓글 id. 최상위면 null. */
  parentCommentId: z.string().nullable(),
  /** 연결된 블록. 페이지 전체 댓글이면 null. */
  blockId: z.string().nullable(),
  /** 연결 당시의 문장. 원문이 바뀌어도 무엇에 단 댓글인지 남는다. */
  anchorText: z.string().nullable(),
  authorUserId: z.string().min(1),
  authorName: z.string().min(1),
  content: z.string().min(1).max(2000),
  resolvedAt: z.string().nullable(),
  createdAt: z.string(),
});

export type Comment = z.infer<typeof commentSchema>;

export const createCommentSchema = z.object({
  content: z.string().min(1).max(2000),
  blockId: z.string().nullable().optional(),
  anchorText: z.string().nullable().optional(),
  parentCommentId: z.string().nullable().optional(),
});

export type CreateCommentInput = z.infer<typeof createCommentSchema>;

export const updateCommentSchema = z.object({
  action: z.enum(["resolve", "reopen"]),
});
