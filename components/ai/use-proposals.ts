"use client";

import { useCallback, useEffect, useState } from "react";

import { applyOperations } from "@/components/editor/proposal";
import type { StoredProposal } from "@/lib/contracts/ai";
import type { Editor } from "@tiptap/core";

/**
 * 대기 중인 제안을 다룬다 — 아키텍처 §14
 *
 * 제안은 서버에 산다. 워크스페이스 AI가 만든 것과 외부 MCP 클라이언트가
 * 만든 것이 같은 목록에 섞여 오고, 이 훅은 그 둘을 구분하지 않는다. 문서를
 * 바꾸는 통로가 하나이므로 승인 절차도 하나다.
 */

export interface ProposalsState {
  proposals: StoredProposal[];
  loading: boolean;
  error: string | null;
  /** 방금 처리한 결과. 토스트 대신 패널 안에서 보여준다(UI 명세 §24). */
  notice: string | null;
  refresh: () => Promise<void>;
  approve: (proposal: StoredProposal) => Promise<void>;
  reject: (proposal: StoredProposal) => Promise<void>;
  dismissNotice: () => void;
}

export function useProposals(
  resourceId: string | null,
  editor: Editor | null,
): ProposalsState {
  const [proposals, setProposals] = useState<StoredProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!resourceId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/resources/${resourceId}/proposals`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "제안을 불러오지 못했습니다.");
      }

      setProposals(body.proposals as StoredProposal[]);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "제안을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    // 서버에서 데이터를 가져오는 구독이다. 규칙이 경계하는 "렌더 중 파생
    // 상태 계산"이 아니라 외부 시스템에서 상태를 끌어오는 쪽이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  /**
   * 승인은 두 단계다.
   *
   * 먼저 서버에서 제안을 선점한다. 그래야 두 사람이 동시에 눌러도 한 번만
   * 반영된다. 선점에 성공한 뒤에야 CRDT에 쓴다. 순서를 뒤집으면 같은 변경이
   * 두 번 들어갈 수 있다.
   */
  const approve = useCallback(
    async (proposal: StoredProposal) => {
      if (!editor) return;

      try {
        const response = await fetch(`/api/proposals/${proposal.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "approve" }),
        });

        const body = await response.json();

        if (!response.ok) {
          throw new Error(body?.error ?? "제안을 적용하지 못했습니다.");
        }

        const applied = applyOperations(
          editor,
          proposal.id,
          proposal.operations,
        );

        setNotice(`AI 제안 ${applied}개를 문서에 반영했습니다.`);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "제안을 적용하지 못했습니다.",
        );
      } finally {
        await refresh();
      }
    },
    [editor, refresh],
  );

  const reject = useCallback(
    async (proposal: StoredProposal) => {
      try {
        const response = await fetch(`/api/proposals/${proposal.id}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action: "reject" }),
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "제안을 거절하지 못했습니다.");
        }

        setNotice("제안을 거절했습니다.");
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : "제안을 거절하지 못했습니다.",
        );
      } finally {
        await refresh();
      }
    },
    [refresh],
  );

  return {
    proposals,
    loading,
    error,
    notice,
    refresh,
    approve,
    reject,
    dismissNotice: () => setNotice(null),
  };
}
