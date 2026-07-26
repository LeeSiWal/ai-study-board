"use client";

import { X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { AiPanel } from "@/components/ai/ai-panel";
import { CommentsPanel } from "@/components/comments/comments-panel";

import { useShell } from "./shell-context";


export function RightPanel() {
  const { openPanel, closePanel } = useShell();
  if (!openPanel) return null;

  const titles = {
    ai: "AI",
    comments: "댓글",
    info: "문서 정보",
    activity: "활동과 버전",
  };

  return (
    <aside
      aria-label={titles[openPanel]}
      data-testid={`panel-${openPanel}`}
      className="border-border bg-surface flex w-90 shrink-0 flex-col border-l max-lg:absolute max-lg:inset-y-0 max-lg:right-0 max-lg:z-20 max-lg:shadow-lg"
    >
      <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-3">
        <div>
          <h2 className="font-medium">{titles[openPanel]}</h2>
          {openPanel === "ai" ? (
            <p className="text-text-tertiary text-[10px]">Study AI · 기본 모델</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" aria-label="패널 닫기" onClick={closePanel}>
          <X aria-hidden className="size-4" />
        </Button>
      </div>

      {openPanel === "ai" ? <AiPanel /> : null}
      {openPanel === "comments" ? <CommentsPanel /> : null}
      {openPanel === "activity" ? <VersionPanel /> : null}
      {openPanel === "info" ? (
        <div className="text-text-secondary flex flex-1 items-center justify-center p-6 text-center">
          준비 중입니다.
        </div>
      ) : null}
    </aside>
  );
}

function VersionPanel() {
  const [selected, setSelected] = useState(0);
  const [restored, setRestored] = useState(false);
  const versions = [
    ["방금", "AI 제안 적용 후", "시월", "초보자 설명 추가"],
    ["12분 전", "AI 제안 적용 전", "Study AI", "적용 전 자동 보관"],
    ["1시간 전", "자동 저장", "민지", "예제 문단 수정"],
  ];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-3">
      <p className="text-text-secondary mb-3 text-xs">버전을 선택해 변경 요약을 미리보고 복원할 수 있습니다.</p>
      {versions.map(([time, reason, author, summary], index) => (
        <button key={time} onClick={() => { setSelected(index); setRestored(false); }} className={`mb-2 w-full rounded-lg border p-3 text-left ${selected === index ? "border-primary bg-primary-soft" : ""}`}>
          <p className="font-medium">{reason}</p><p className="text-text-secondary mt-1 text-xs">{time} · {author}</p><p className="mt-2 text-xs">{summary}</p>
        </button>
      ))}
      <div className="mt-4 rounded-lg bg-surface-subtle p-3 text-xs"><strong>읽기 전용 미리보기</strong><p className="mt-2">{versions[selected][3]}</p></div>
      <Button className="mt-3 w-full" variant="outline" onClick={() => {
        if (window.confirm(`${versions[selected][0]} 버전으로 복원할까요? 현재 상태는 새 버전으로 보관됩니다.`)) setRestored(true);
      }}>이 버전으로 복원</Button>
      {restored ? <p className="text-success mt-2 text-center text-xs">현재 상태를 보관하고 선택한 버전을 복원했습니다.</p> : null}
    </div>
  );
}
