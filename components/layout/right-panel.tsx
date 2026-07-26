"use client";

import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

import { useShell, type PanelKind } from "./shell-context";

/**
 * 우측 패널 — UI 명세 §4
 *
 * 실제 내용은 Phase 3(AI·댓글)과 Phase 4(버전·정보)에서 채운다. 지금은
 * 셸이 자리를 잡고 열고 닫히는지만 확인한다. 준비 중이라도 화면이 완전히
 * 죽어 보이지 않게 무엇이 들어올지 적어 둔다(§1).
 */

const PANELS: Record<PanelKind, { title: string; note: string }> = {
  ai: {
    title: "AI",
    note: "현재 문서와 워크스페이스 자료를 기준으로 질문하고, 요약하거나 수정 제안을 만듭니다.",
  },
  comments: {
    title: "댓글",
    note: "문장이나 블록에 댓글을 남기고 답글과 해결 상태를 관리합니다.",
  },
  info: {
    title: "문서 정보",
    note: "작성자, 생성 시각, 연결된 자료를 봅니다.",
  },
  activity: {
    title: "활동과 버전",
    note: "누가 무엇을 바꿨는지, 어느 시점으로 되돌릴 수 있는지 봅니다.",
  },
};

export function RightPanel() {
  const { openPanel, closePanel } = useShell();

  if (!openPanel) return null;

  const panel = PANELS[openPanel];

  return (
    <aside
      aria-label={panel.title}
      data-testid={`panel-${openPanel}`}
      className="border-border bg-surface flex w-90 shrink-0 flex-col border-l max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-lg"
    >
      <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-3">
        <h2 className="font-medium">{panel.title}</h2>
        <Button
          variant="ghost"
          size="icon"
          aria-label="패널 닫기"
          onClick={closePanel}
        >
          <X aria-hidden className="size-4" />
        </Button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
        <p className="text-text-secondary">준비 중입니다.</p>
        <p className="text-text-tertiary text-xs">{panel.note}</p>
      </div>
    </aside>
  );
}
