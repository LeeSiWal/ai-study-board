import { and, asc, eq, isNull } from "drizzle-orm";

import type { Comment, CreateCommentInput } from "../contracts/comments";
import { db, schema } from "../db";
import { randomId } from "../id";
import { findUserById } from ".";

/**
 * 댓글 저장소 — 아키텍처 §18
 *
 * 서버에 두는 이유는 새로고침을 견디기 위해서만이 아니다. 댓글은 협업
 * 기능인데 브라우저 상태에만 있으면 다른 멤버에게 보이지 않는다. 보이지
 * 않는 댓글은 없는 것과 같다.
 */

type Row = typeof schema.comments.$inferSelect;

/** 작성자 이름은 조인해서 붙인다. 이름이 바뀌면 과거 댓글도 따라간다. */
function toComment(row: Row, authorName: string): Comment {
  return {
    id: row.id,
    resourceId: row.resourceId,
    parentCommentId: row.parentCommentId,
    blockId: row.blockId,
    anchorText: row.anchorText,
    authorUserId: row.authorUserId,
    authorName,
    content: row.content,
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listComments(resourceId: string): Promise<Comment[]> {
  const rows = await db
    .select()
    .from(schema.comments)
    .innerJoin(schema.users, eq(schema.comments.authorUserId, schema.users.id))
    .where(eq(schema.comments.resourceId, resourceId))
    .orderBy(asc(schema.comments.createdAt));

  return rows.map((row) => toComment(row.comments, row.users.displayName));
}

export async function findComment(id: string): Promise<Comment | null> {
  const row = await db.query.comments.findFirst({
    where: eq(schema.comments.id, id),
  });

  if (!row) return null;

  const author = await findUserById(row.authorUserId);
  return toComment(row, author?.displayName ?? "알 수 없음");
}

export async function createComment(
  resourceId: string,
  author: { id: string; displayName: string },
  input: CreateCommentInput,
): Promise<Comment> {
  const [row] = await db
    .insert(schema.comments)
    .values({
      id: randomId(),
      resourceId,
      parentCommentId: input.parentCommentId ?? null,
      blockId: input.blockId ?? null,
      anchorText: input.anchorText ?? null,
      authorUserId: author.id,
      content: input.content,
    })
    .returning();

  return toComment(row, author.displayName);
}

/**
 * 해결 상태를 바꾼다.
 *
 * 답글은 따로 해결하지 않는다. 스레드 단위로 다루는 것이 UI 명세 §12의
 * 모델이고, 답글마다 해결 상태가 생기면 무엇이 남았는지 알기 어려워진다.
 */
export async function setCommentResolved(
  id: string,
  resolved: boolean,
): Promise<Comment | null> {
  const [row] = await db
    .update(schema.comments)
    .set({ resolvedAt: resolved ? new Date() : null })
    .where(
      and(
        eq(schema.comments.id, id),
        isNull(schema.comments.parentCommentId),
      ),
    )
    .returning();

  if (!row) return null;

  const author = await findUserById(row.authorUserId);
  return toComment(row, author?.displayName ?? "알 수 없음");
}
