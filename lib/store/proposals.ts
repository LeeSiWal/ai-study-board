import { and, desc, eq } from "drizzle-orm";

import {
  aiOperationSchema,
  type AiProposalOrigin,
  type AiProposalStatus,
  type StoredProposal,
} from "../contracts/ai";
import { db, schema } from "../db";

/**
 * AI 제안 저장소 — 아키텍처 §18의 `ai_proposals`
 *
 * 제안이 서버에 남아야 만든 시점과 승인 시점이 갈라질 수 있다. Claude Code가
 * 만든 제안을 사람이 나중에 브라우저에서 확인하는 흐름이 여기 기댄다.
 *
 * 워크스페이스 안의 AI가 만든 제안도 같은 표에 넣는다. 문서를 바꾸는 통로를
 * 하나로 유지하면 승인·이력·복구가 한 곳에 모인다(§15.4).
 */

type Row = typeof schema.aiProposals.$inferSelect;

/**
 * operations는 JSON 문자열로 저장된다.
 *
 * 형태의 소유자는 `lib/contracts/ai.ts`의 Zod다. 읽을 때 그것으로 검증해서,
 * 스키마가 바뀐 뒤 남아 있는 옛 레코드가 조용히 통과하지 않게 한다.
 */
function toProposal(row: Row): StoredProposal {
  return {
    id: row.id,
    resourceId: row.resourceId,
    baseVersion: row.baseVersion,
    modelLabel: row.modelLabel,
    summary: row.summary,
    operations: aiOperationSchema
      .array()
      .parse(JSON.parse(row.operations)),
    origin: row.origin as AiProposalOrigin,
    createdBy: row.createdBy,
    createdByLabel: row.createdByLabel,
    status: row.status as AiProposalStatus,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    resolvedBy: row.resolvedBy,
  };
}

export interface SaveProposalInput {
  proposal: Omit<
    StoredProposal,
    "status" | "createdAt" | "resolvedAt" | "resolvedBy"
  >;
}

export async function saveProposal({
  proposal,
}: SaveProposalInput): Promise<StoredProposal> {
  const [row] = await db
    .insert(schema.aiProposals)
    .values({
      id: proposal.id,
      resourceId: proposal.resourceId,
      baseVersion: proposal.baseVersion,
      modelLabel: proposal.modelLabel,
      summary: proposal.summary,
      operations: JSON.stringify(proposal.operations),
      origin: proposal.origin,
      createdBy: proposal.createdBy,
      createdByLabel: proposal.createdByLabel,
    })
    .returning();

  return toProposal(row);
}

/**
 * 문서의 대기 중인 제안. 최근 것이 먼저 온다.
 *
 * 처리된 제안은 돌려주지 않는다. 승인·거절한 것을 다시 보여주면 사용자가
 * 같은 판단을 반복하게 된다. 이력은 활동 기록이 담당한다(§18).
 */
export async function listPendingProposals(
  resourceId: string,
): Promise<StoredProposal[]> {
  const rows = await db.query.aiProposals.findMany({
    where: and(
      eq(schema.aiProposals.resourceId, resourceId),
      eq(schema.aiProposals.status, "pending"),
    ),
    orderBy: [desc(schema.aiProposals.createdAt)],
  });

  return rows.map(toProposal);
}

export async function findProposal(
  id: string,
): Promise<StoredProposal | null> {
  const row = await db.query.aiProposals.findFirst({
    where: eq(schema.aiProposals.id, id),
  });

  return row ? toProposal(row) : null;
}

/**
 * 제안을 처리 완료로 표시한다.
 *
 * `status = 'pending'` 조건을 UPDATE에 함께 건다. 두 사람이 동시에 눌러도
 * 데이터베이스가 한 명만 통과시키므로, 애플리케이션에서 잠금을 흉내 낼
 * 필요가 없다. 진 쪽은 빈 결과를 받는다.
 */
export async function resolveProposal(
  id: string,
  status: Exclude<AiProposalStatus, "pending">,
  userId: string,
): Promise<StoredProposal | null> {
  const [row] = await db
    .update(schema.aiProposals)
    .set({ status, resolvedAt: new Date(), resolvedBy: userId })
    .where(
      and(
        eq(schema.aiProposals.id, id),
        eq(schema.aiProposals.status, "pending"),
      ),
    )
    .returning();

  return row ? toProposal(row) : null;
}

/** 화면에 보여줄 출처 이름. */
export function originLabel(origin: AiProposalOrigin): string {
  return origin === "mcp_client" ? "외부 AI" : "워크스페이스 AI";
}
