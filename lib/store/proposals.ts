import type {
  AiProposalOrigin,
  AiProposalStatus,
  StoredProposal,
} from "../contracts/ai";

/**
 * AI 제안 저장소 — 아키텍처 §18의 `ai_proposals`
 *
 * 제안이 서버에 남아야 만든 시점과 승인 시점이 갈라질 수 있다. Claude Code가
 * 만든 제안을 사람이 나중에 브라우저에서 확인하는 흐름이 여기 기댄다.
 *
 * 워크스페이스 안의 AI가 만든 제안도 같은 곳에 넣는다. 문서를 바꾸는 통로를
 * 하나로 유지하면 승인·이력·복구가 한 곳에 모인다(§15.4).
 */

const PROPOSALS_KEY = Symbol.for("ai-study-board.proposals");

type GlobalWithProposals = typeof globalThis & {
  [PROPOSALS_KEY]?: StoredProposal[];
};

function store(): StoredProposal[] {
  const scope = globalThis as GlobalWithProposals;
  scope[PROPOSALS_KEY] ??= [];
  return scope[PROPOSALS_KEY];
}

export interface SaveProposalInput {
  proposal: Omit<StoredProposal, "status" | "createdAt" | "resolvedAt" | "resolvedBy">;
}

export function saveProposal({ proposal }: SaveProposalInput): StoredProposal {
  const record: StoredProposal = {
    ...proposal,
    status: "pending",
    createdAt: new Date().toISOString(),
    resolvedAt: null,
    resolvedBy: null,
  };

  store().push(record);
  return record;
}

/**
 * 문서의 대기 중인 제안. 최근 것이 먼저 온다.
 *
 * 처리된 제안은 돌려주지 않는다. 승인·거절한 것을 다시 보여주면 사용자가
 * 같은 판단을 반복하게 된다. 이력은 활동 기록이 담당한다(§18).
 */
export function listPendingProposals(resourceId: string): StoredProposal[] {
  return store()
    .filter(
      (record) => record.resourceId === resourceId && record.status === "pending",
    )
    .reverse();
}

export function findProposal(id: string): StoredProposal | null {
  return store().find((record) => record.id === id) ?? null;
}

/**
 * 제안을 처리 완료로 표시한다.
 *
 * 이미 처리된 제안은 다시 바꾸지 않는다. UI 명세 §2가 "이 AI 제안은 이미
 * 다른 멤버가 처리했습니다"를 안내하라고 한 상황이다.
 */
export function resolveProposal(
  id: string,
  status: Exclude<AiProposalStatus, "pending">,
  userId: string,
): StoredProposal | null {
  const record = findProposal(id);
  if (!record || record.status !== "pending") return null;

  record.status = status;
  record.resolvedAt = new Date().toISOString();
  record.resolvedBy = userId;

  return record;
}

/** 화면에 보여줄 출처 이름. */
export function originLabel(origin: AiProposalOrigin): string {
  return origin === "mcp_client" ? "외부 AI" : "워크스페이스 AI";
}
