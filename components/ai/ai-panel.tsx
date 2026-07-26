"use client";

import { Check, Loader2, Send, Sparkles, Undo2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { applyOperations, collectBlocks, currentTextOf } from "@/components/editor/proposal";
import { useShell } from "@/components/layout/shell-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiOperation, AiProposal } from "@/lib/contracts/ai";

/**
 * AI-01 AI 패널 / AI-02 수정 제안 비교 — UI 명세 §13·§14
 *
 * 답변과 제안 모두 AI Gateway를 거친 실제 실행 결과다. 제안은 `blockId`로
 * 대상을 지목하고, 충돌 판정은 협업 서버의 `content_version`으로 한다.
 */

const SUGGESTIONS = [
  "이 문서 요약",
  "핵심 개념 설명",
  "예상 질문 만들기",
] as const;

type ProposalState =
  | { kind: "none" }
  | { kind: "loading" }
  | { kind: "ready"; proposal: AiProposal; conflicted: boolean }
  | { kind: "applied"; proposal: AiProposal; count: number }
  | { kind: "rejected" }
  | { kind: "error"; message: string };

export function AiPanel() {
  const { editor } = useShell();
  const params = useParams<{ resourceId?: string }>();
  const resourceId = params.resourceId ?? null;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [proposalState, setProposalState] = useState<ProposalState>({
    kind: "none",
  });

  const abort = useRef<AbortController | null>(null);

  function stop() {
    abort.current?.abort();
    abort.current = null;
    setStreaming(false);
  }

  async function ask(prompt = question) {
    if (!prompt.trim() || !editor || !resourceId) return;

    stop();
    setQuestion(prompt);
    setAnswer("");
    setAnswerError(null);
    setProposalState({ kind: "none" });
    setStreaming(true);

    const controller = new AbortController();
    abort.current = controller;

    try {
      const response = await fetch("/api/ai/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          resourceId,
          operationType: "answer",
          prompt,
          blocks: collectBlocks(editor),
          baseVersion: 0,
        }),
      });

      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "AI 응답을 받지 못했습니다.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      // 점진 출력. 전체 패널에 스피너를 띄우지 않는다(§13).
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        setAnswer((current) => current + decoder.decode(value, { stream: true }));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setAnswerError(
        error instanceof Error ? error.message : "AI 응답을 받지 못했습니다.",
      );
    } finally {
      setStreaming(false);
      abort.current = null;
    }
  }

  async function makeProposal() {
    if (!editor || !resourceId) return;

    setProposalState({ kind: "loading" });

    try {
      const response = await fetch("/api/ai/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resourceId,
          operationType: "propose",
          prompt: question || "이 문서의 문장을 다듬어 주세요.",
          blocks: collectBlocks(editor),
          baseVersion: 0,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        throw new Error(body?.error ?? "제안을 만들지 못했습니다.");
      }

      setProposalState({
        kind: "ready",
        proposal: body as AiProposal,
        conflicted: false,
      });
    } catch (error) {
      setProposalState({
        kind: "error",
        message:
          error instanceof Error ? error.message : "제안을 만들지 못했습니다.",
      });
    }
  }

  /**
   * 적용 직전에 현재 버전을 다시 읽는다.
   *
   * 제안을 만든 뒤 다른 멤버가 문서를 바꿨을 수 있다. 본문 길이나 마지막
   * 글자를 비교하면 가운데를 고친 경우를 놓치므로, 저장할 때마다 올라가는
   * 정수를 기준으로 판단한다(§14).
   */
  async function applyProposal() {
    if (proposalState.kind !== "ready" || !editor || !resourceId) return;

    const { proposal } = proposalState;

    try {
      const response = await fetch(
        `/api/resources/${resourceId}/content-version`,
      );
      const body: { version?: number } = await response.json();

      if (response.ok && body.version !== proposal.baseVersion) {
        setProposalState({ kind: "ready", proposal, conflicted: true });
        return;
      }
    } catch {
      // 버전을 못 읽으면 조용히 덮어쓰지 않고 충돌로 취급한다.
      setProposalState({ kind: "ready", proposal, conflicted: true });
      return;
    }

    const count = applyOperations(editor, proposal.id, proposal.operations);
    setProposalState({ kind: "applied", proposal, count });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => ask(item)}
              disabled={streaming}
              className="border-border hover:bg-surface-subtle rounded-full border px-2.5 py-1.5 text-xs disabled:opacity-50"
            >
              {item}
            </button>
          ))}
        </div>

        {answerError ? (
          <p
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
          >
            {answerError}
          </p>
        ) : null}

        {answer || streaming ? (
          <div className="bg-primary-soft/50 rounded-xl p-3 leading-relaxed">
            <p className="text-ai mb-1 flex items-center gap-1 font-medium">
              <Sparkles aria-hidden className="size-3.5" /> Study AI
            </p>
            <p className="whitespace-pre-wrap">
              {answer}
              {streaming ? <span aria-label="생성 중">▍</span> : null}
            </p>
            {/* 출처가 없는 내용을 있는 것처럼 표현하지 않는다(§13). */}
            <p className="text-text-tertiary mt-2 text-[11px]">출처 · 현재 문서</p>
            {!streaming && answer ? (
              <Button
                className="mt-2"
                size="sm"
                variant="outline"
                onClick={makeProposal}
              >
                수정 제안으로 보기
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-text-secondary py-8 text-center text-xs">
            현재 문서를 기준으로 질문하거나 추천 작업을 선택하세요.
          </p>
        )}

        <ProposalCard
          state={proposalState}
          onApply={applyProposal}
          onReject={() => setProposalState({ kind: "rejected" })}
          onUndo={() => editor?.commands.undo()}
          currentText={(blockId) =>
            editor ? currentTextOf(editor, blockId) : null
          }
        />
      </div>

      <form
        className="border-border border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <p className="text-text-tertiary mb-2 text-[11px]">컨텍스트 · 현재 문서</p>
        <div className="flex gap-2">
          <Input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="문서에 대해 질문하세요"
          />
          <Button
            type={streaming ? "button" : "submit"}
            size="icon"
            onClick={streaming ? stop : undefined}
            aria-label={streaming ? "생성 중지" : "전송"}
          >
            {streaming ? <X className="size-4" /> : <Send className="size-4" />}
          </Button>
        </div>
      </form>
    </div>
  );
}

function ProposalCard({
  state,
  onApply,
  onReject,
  onUndo,
  currentText,
}: {
  state: ProposalState;
  onApply: () => void;
  onReject: () => void;
  onUndo: () => void;
  currentText: (blockId: string) => string | null;
}) {
  if (state.kind === "none" || state.kind === "rejected") return null;

  if (state.kind === "loading") {
    return (
      <p className="text-text-secondary flex items-center gap-2 text-xs">
        <Loader2 aria-hidden className="size-3.5 animate-spin" />
        제안을 만드는 중…
      </p>
    );
  }

  if (state.kind === "error") {
    return (
      <p
        role="alert"
        className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
      >
        {state.message}
      </p>
    );
  }

  if (state.kind === "applied") {
    return (
      <div
        className="border-border rounded-xl border p-3"
        data-testid="ai-proposal"
      >
        <div className="text-success flex items-center justify-between text-xs">
          <span className="flex items-center gap-1">
            <Check aria-hidden className="size-3.5" />
            AI 제안 {state.count}개를 문서에 반영했습니다.
          </span>
          <Button size="sm" variant="ghost" onClick={onUndo}>
            <Undo2 aria-hidden className="size-3.5" /> 실행 취소
          </Button>
        </div>
      </div>
    );
  }

  const { proposal, conflicted } = state;

  return (
    <div className="border-border rounded-xl border p-3" data-testid="ai-proposal">
      <div className="flex items-baseline justify-between">
        <h3 className="font-medium">AI 수정 제안</h3>
        <span className="text-text-tertiary text-[11px]">
          기준 버전 {proposal.baseVersion}
        </span>
      </div>
      <p className="text-text-secondary mt-1 text-xs">{proposal.summary}</p>

      {conflicted ? (
        <p role="alert" className="text-warning mt-2 text-xs">
          제안이 생성된 후 문서가 변경되었습니다. 변경 내용을 현재 문서에 맞춰
          다시 확인해주세요.
        </p>
      ) : null}

      {proposal.operations.length === 0 ? (
        <p className="text-text-secondary mt-2 text-xs">
          제안할 변경이 없습니다.
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {proposal.operations.map((operation, index) => (
            <li key={`${operation.blockId}-${index}`}>
              <OperationDiff
                operation={operation}
                before={currentText(operation.blockId)}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onReject}>
          거절
        </Button>
        <Button
          size="sm"
          disabled={conflicted || proposal.operations.length === 0}
          onClick={onApply}
        >
          전체 적용
        </Button>
      </div>
    </div>
  );
}

/**
 * 색만으로 변경 종류를 구분하지 않고 레이블을 함께 쓴다(§14·§26).
 */
function OperationDiff({
  operation,
  before,
}: {
  operation: AiOperation;
  before: string | null;
}) {
  return (
    <div className="border-border rounded-lg border p-2 text-xs">
      <p className="text-text-secondary mb-1.5">{operation.reason}</p>

      {operation.type !== "insert_after" && before !== null ? (
        <div className="bg-danger/5 rounded p-2">
          <strong>삭제 · 원문</strong>
          <p className="mt-1 line-through">{before}</p>
        </div>
      ) : null}

      {operation.type !== "delete_block" ? (
        <div className="bg-success/5 mt-1 rounded p-2">
          <strong>추가 · 제안</strong>
          <p className="mt-1">{operation.content}</p>
        </div>
      ) : null}
    </div>
  );
}
