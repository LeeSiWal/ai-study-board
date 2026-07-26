import type { Comment, CreateCommentInput } from "../contracts/comments";

/**
 * 댓글 저장소 — 아키텍처 §18
 *
 * 서버에 두는 이유는 단순히 새로고침을 견디기 위해서가 아니다. 댓글은
 * 협업 기능인데 브라우저 상태에만 있으면 다른 멤버에게 보이지 않는다.
 * 보이지 않는 댓글은 없는 것과 같다.
 */

const COMMENTS_KEY = Symbol.for("ai-study-board.comments");

type GlobalWithComments = typeof globalThis & {
  [COMMENTS_KEY]?: Comment[];
};

function store(): Comment[] {
  const scope = globalThis as GlobalWithComments;
  scope[COMMENTS_KEY] ??= [];
  return scope[COMMENTS_KEY];
}

export function listComments(resourceId: string): Comment[] {
  return store()
    .filter((comment) => comment.resourceId === resourceId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function findComment(id: string): Comment | null {
  return store().find((comment) => comment.id === id) ?? null;
}

export function createComment(
  resourceId: string,
  author: { id: string; displayName: string },
  input: CreateCommentInput,
): Comment {
  const comment: Comment = {
    id: crypto.randomUUID(),
    resourceId,
    parentCommentId: input.parentCommentId ?? null,
    blockId: input.blockId ?? null,
    anchorText: input.anchorText ?? null,
    authorUserId: author.id,
    authorName: author.displayName,
    content: input.content,
    resolvedAt: null,
    createdAt: new Date().toISOString(),
  };

  store().push(comment);
  return comment;
}

/**
 * 해결 상태를 바꾼다.
 *
 * 답글은 따로 해결하지 않는다. 스레드 단위로 다루는 것이 UI 명세 §12의
 * 모델이고, 답글마다 해결 상태가 생기면 무엇이 남았는지 알기 어려워진다.
 */
export function setCommentResolved(
  id: string,
  resolved: boolean,
): Comment | null {
  const comment = findComment(id);
  if (!comment || comment.parentCommentId) return null;

  comment.resolvedAt = resolved ? new Date().toISOString() : null;
  return comment;
}
