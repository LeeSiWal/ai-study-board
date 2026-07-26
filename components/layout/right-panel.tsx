"use client";

import { Check, Send, Sparkles, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useShell } from "./shell-context";

interface CommentThread {
  id: string;
  author: string;
  body: string;
  anchor: string;
  resolved: boolean;
  replies: string[];
}

interface Proposal {
  id: string;
  before: string;
  after: string;
  baseFingerprint: string;
  applied: boolean;
  rejected: boolean;
}

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

function fingerprint(text: string) {
  return `${text.length}:${text.slice(-40)}`;
}

function AiPanel() {
  const { editor } = useShell();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setStreaming(false);
  };

  useEffect(() => stop, []);

  function ask(prompt = question) {
    if (!prompt.trim()) return;
    stop();
    setQuestion(prompt);
    setAnswer("");
    setProposal(null);
    setStreaming(true);

    const full =
      "Query는 찾고 싶은 정보, Key는 각 정보의 표지, Value는 실제 내용입니다. Query와 Key의 유사도로 어떤 Value를 얼마나 참고할지 결정합니다.";
    let index = 0;
    timer.current = setInterval(() => {
      index += 2;
      setAnswer(full.slice(0, index));
      if (index >= full.length) stop();
    }, 25);
  }

  function makeProposal() {
    if (!editor) return;
    const before = editor.getText();
    setProposal({
      id: crypto.randomUUID(),
      before: before || "빈 문서",
      after:
        "Query는 질문, Key는 색인표, Value는 실제 정보라고 생각하면 쉽습니다. Query와 가장 가까운 Key를 찾아 관련 Value에 더 집중합니다.",
      baseFingerprint: fingerprint(before),
      applied: false,
      rejected: false,
    });
  }

  const conflicted =
    !!proposal && !!editor && fingerprint(editor.getText()) !== proposal.baseFingerprint;

  function applyProposal() {
    if (!editor || !proposal || conflicted) return;
    editor
      .chain()
      .focus("end")
      .insertContent(`<p>${proposal.after}</p>`)
      .run();
    setProposal({ ...proposal, applied: true });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          {["이 문서 요약", "핵심 개념 설명", "예상 질문 만들기"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => ask(item)}
              className="border-border hover:bg-surface-subtle rounded-full border px-2.5 py-1.5 text-xs"
            >
              {item}
            </button>
          ))}
        </div>

        {answer ? (
          <div className="bg-primary-soft/50 rounded-xl p-3 text-sm leading-relaxed">
            <p className="mb-1 flex items-center gap-1 font-medium text-ai">
              <Sparkles className="size-3.5" /> Study AI
            </p>
            <p>{answer}{streaming ? <span aria-label="생성 중"> ▍</span> : null}</p>
            <p className="text-text-tertiary mt-2 text-[11px]">출처 · 현재 문서</p>
            {!streaming ? (
              <Button className="mt-2" size="sm" variant="outline" onClick={makeProposal}>
                수정 제안으로 보기
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-text-secondary py-8 text-center text-xs">
            현재 문서를 기준으로 질문하거나 추천 작업을 선택하세요.
          </p>
        )}

        {proposal && !proposal.rejected ? (
          <div className="border-border rounded-xl border p-3" data-testid="ai-proposal">
            <h3 className="font-medium">AI 수정 제안</h3>
            {conflicted ? (
              <p role="alert" className="text-warning mt-2 text-xs">
                제안 생성 후 문서가 변경되었습니다. 현재 버전에 맞춰 다시 생성해 주세요.
              </p>
            ) : null}
            <div className="mt-2 space-y-2 text-xs">
              <div className="bg-danger/5 rounded p-2">
                <strong>삭제 · 원문</strong><p className="mt-1 line-through">{proposal.before}</p>
              </div>
              <div className="bg-success/5 rounded p-2">
                <strong>추가 · 제안</strong><p className="mt-1">{proposal.after}</p>
              </div>
            </div>
            {proposal.applied ? (
              <div className="text-success mt-3 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1"><Check className="size-3.5" /> 적용됨</span>
                <Button size="sm" variant="ghost" onClick={() => editor?.commands.undo()}>
                  <Undo2 className="size-3.5" /> 실행 취소
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setProposal({ ...proposal, rejected: true })}>
                  거절
                </Button>
                <Button size="sm" disabled={conflicted} onClick={applyProposal}>전체 적용</Button>
              </div>
            )}
          </div>
        ) : null}
      </div>

      <form
        className="border-border border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          ask();
        }}
      >
        <p className="text-text-tertiary mb-2 text-[11px]">컨텍스트 · 현재 문서</p>
        <div className="flex gap-2">
          <Input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="문서에 대해 질문하세요" />
          <Button type={streaming ? "button" : "submit"} size="icon" onClick={streaming ? stop : undefined} aria-label={streaming ? "생성 중지" : "전송"}>
            {streaming ? <X className="size-4" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

function CommentsPanel() {
  const { editor } = useShell();
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);
  const [threads, setThreads] = useState<CommentThread[]>([]);

  function addComment() {
    if (!body.trim()) return;
    const node = editor?.state.selection.$from.parent;
    setThreads((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        author: "시월",
        body: body.trim(),
        anchor: node?.textContent || "페이지 전체",
        resolved: false,
        replies: [],
      },
    ]);
    setBody("");
  }

  const visible = threads.filter((thread) => showResolved || !thread.resolved);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <label className="border-border flex items-center gap-2 border-b px-3 py-2 text-xs">
        <input type="checkbox" checked={showResolved} onChange={(e) => setShowResolved(e.target.checked)} />
        해결된 댓글 보기
      </label>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {!visible.length ? (
          <p className="text-text-secondary py-10 text-center text-xs">
            아직 댓글이 없습니다. 문장에서 댓글을 남기거나 팀원과 의견을 나눠보세요.
          </p>
        ) : null}
        {visible.map((thread) => (
          <article key={thread.id} className="border-border rounded-xl border p-3">
            <p className="font-medium">{thread.author}</p>
            <p className="text-text-tertiary mt-1 truncate text-[11px]">연결 · {thread.anchor}</p>
            <p className="mt-2">{thread.body}</p>
            {thread.replies.map((reply, index) => <p key={index} className="bg-surface-subtle mt-2 rounded p-2 text-xs">답글 · {reply}</p>)}
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => {
                const reply = window.prompt("답글을 입력하세요.");
                if (reply?.trim()) setThreads((all) => all.map((item) => item.id === thread.id ? { ...item, replies: [...item.replies, reply.trim()] } : item));
              }}>답글</Button>
              <Button size="sm" variant="ghost" onClick={() => setThreads((all) => all.map((item) => item.id === thread.id ? { ...item, resolved: !item.resolved } : item))}>
                {thread.resolved ? "다시 열기" : "해결"}
              </Button>
            </div>
          </article>
        ))}
      </div>
      <div className="border-border flex gap-2 border-t p-3">
        <Input value={body} onChange={(event) => setBody(event.target.value)} placeholder="댓글을 입력하세요" onKeyDown={(event) => {
          if (event.key === "Enter") addComment();
        }} />
        <Button size="icon" onClick={addComment} aria-label="댓글 추가"><Send className="size-4" /></Button>
      </div>
    </div>
  );
}
