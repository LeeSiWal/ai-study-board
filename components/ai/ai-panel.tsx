"use client";

import { Loader2, RefreshCw, Send, Sparkles, Undo2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useRef, useState } from "react";

import { collectBlocks, currentTextOf } from "@/components/editor/proposal";
import { useShell } from "@/components/layout/shell-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AiOperation, StoredProposal } from "@/lib/contracts/ai";

import { useProposals } from "./use-proposals";

/**
 * AI-01 AI 패널 / AI-02 수정 제안 비교 — UI 명세 §13·§14
 *
 * 제안은 서버에 산다. 워크스페이스 AI가 만든 것과 Claude Code 같은 외부
 * MCP 클라이언트가 만든 것이 한 목록에 섞여 오고, 승인 절차는 하나다.
 */

const SUGGESTIONS = [
  "이 문서 요약",
  "핵심 개념 설명",
  "예상 질문 만들기",
] as const;

export function AiPanel() {
  const { editor } = useShell();
  const params = useParams<{ resourceId?: string }>();
  const resourceId = params.resourceId ?? null;

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);
  const [proposing, setProposing] = useState(false);

  const abort = useRef<AbortController | null>(null);
  const proposals = useProposals(resourceId, editor);

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

    setProposing(true);
    setAnswerError(null);

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

      // 서버에 저장됐으므로 목록을 다시 읽는다.
      await proposals.refresh();
    } catch (error) {
      setAnswerError(
        error instanceof Error ? error.message : "제안을 만들지 못했습니다.",
      );
    } finally {
      setProposing(false);
    }
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
                disabled={proposing}
              >
                {proposing ? (
                  <>
                    <Loader2 aria-hidden className="size-3.5 animate-spin" />
                    제안 만드는 중…
                  </>
                ) : (
                  "수정 제안으로 보기"
                )}
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-text-secondary py-8 text-center text-xs">
            현재 문서를 기준으로 질문하거나 추천 작업을 선택하세요.
          </p>
        )}

        <ProposalSection
          state={proposals}
          currentText={(blockId) =>
            editor ? currentTextOf(editor, blockId) : null
          }
          onUndo={() => editor?.commands.undo()}
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

function ProposalSection({
  state,
  currentText,
  onUndo,
}: {
  state: ReturnType<typeof useProposals>;
  currentText: (blockId: string) => string | null;
  onUndo: () => void;
}) {
  return (
    <section aria-label="수정 제안" className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-text-secondary text-xs font-medium">
          대기 중인 제안 {state.proposals.length > 0 ? `(${state.proposals.length})` : ""}
        </h3>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="제안 다시 불러오기"
          onClick={() => void state.refresh()}
          disabled={state.loading}
        >
          <RefreshCw
            aria-hidden
            className={`size-3.5 ${state.loading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      {state.notice ? (
        <div className="border-success/30 bg-success/5 text-success flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
          <span>{state.notice}</span>
          <span className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={onUndo}>
              <Undo2 aria-hidden className="size-3.5" /> 실행 취소
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              aria-label="알림 닫기"
              onClick={state.dismissNotice}
            >
              <X aria-hidden className="size-3.5" />
            </Button>
          </span>
        </div>
      ) : null}

      {state.error ? (
        <p
          role="alert"
          className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
        >
          {state.error}
        </p>
      ) : null}

      {!state.proposals.length && !state.loading ? (
        <p className="text-text-tertiary text-xs">
          대기 중인 제안이 없습니다. 외부 AI가 만든 제안도 여기에 나타납니다.
        </p>
      ) : null}

      {state.proposals.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          currentText={currentText}
          onApprove={() => void state.approve(proposal)}
          onReject={() => void state.reject(proposal)}
        />
      ))}
    </section>
  );
}

function ProposalCard({
  proposal,
  currentText,
  onApprove,
  onReject,
}: {
  proposal: StoredProposal;
  currentText: (blockId: string) => string | null;
  onApprove: () => void;
  onReject: () => void;
}) {
  const external = proposal.origin === "mcp_client";

  return (
    <div className="border-border rounded-xl border p-3" data-testid="ai-proposal">
      <div className="flex items-baseline justify-between gap-2">
        {/* 어디서 온 제안인지가 승인 판단에 영향을 준다(§15.4). */}
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
            external
              ? "bg-warning/10 text-warning"
              : "bg-primary-soft text-primary"
          }`}
        >
          {external ? "외부 AI" : "워크스페이스 AI"} · {proposal.createdByLabel}
        </span>
        <span className="text-text-tertiary shrink-0 text-[11px]">
          기준 버전 {proposal.baseVersion}
        </span>
      </div>

      <p className="text-text-secondary mt-2 text-xs">{proposal.summary}</p>

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

      <div className="mt-3 flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onReject}>
          거절
        </Button>
        <Button size="sm" onClick={onApprove}>
          전체 적용
        </Button>
      </div>
    </div>
  );
}

/** 색만으로 변경 종류를 구분하지 않고 레이블을 함께 쓴다(§14·§26). */
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
