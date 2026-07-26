"use client";

import { Loader2, RefreshCw, Send } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { useShell } from "@/components/layout/shell-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Comment } from "@/lib/contracts/comments";

/**
 * COM-01 댓글 패널 — UI 명세 §12
 *
 * 댓글은 서버에 산다. 브라우저 상태에만 두면 다른 멤버에게 보이지 않는데,
 * 보이지 않는 댓글은 협업 도구에서 없는 것과 같다.
 *
 * 스레드는 최상위 댓글 하나와 그 답글들로 이룬다. 해결은 스레드 단위다.
 */

interface Thread {
  root: Comment;
  replies: Comment[];
}

function toThreads(comments: Comment[]): Thread[] {
  const roots = comments.filter((comment) => !comment.parentCommentId);

  return roots.map((root) => ({
    root,
    replies: comments.filter((comment) => comment.parentCommentId === root.id),
  }));
}

export function CommentsPanel() {
  const { editor } = useShell();
  const params = useParams<{ resourceId?: string }>();
  const resourceId = params.resourceId ?? null;

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [showResolved, setShowResolved] = useState(false);

  const refresh = useCallback(async () => {
    if (!resourceId) return;

    setLoading(true);

    try {
      const response = await fetch(`/api/resources/${resourceId}/comments`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error ?? "댓글을 불러오지 못했습니다.");
      }

      setComments(data.comments as Comment[]);
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "댓글을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, [resourceId]);

  useEffect(() => {
    // 서버에서 데이터를 끌어오는 구독이다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  async function send(input: {
    content: string;
    parentCommentId?: string | null;
  }) {
    if (!resourceId || !input.content.trim()) return;

    // 최상위 댓글은 지금 커서가 있는 블록에 건다. AI 제안과 같은 앵커라
    // 문서를 편집해도 대상을 잃지 않는다(§14).
    const node = input.parentCommentId
      ? null
      : editor?.state.selection.$from.parent;

    const blockId =
      typeof node?.attrs.blockId === "string" ? node.attrs.blockId : null;

    try {
      const response = await fetch(`/api/resources/${resourceId}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          content: input.content.trim(),
          parentCommentId: input.parentCommentId ?? null,
          blockId,
          anchorText: node?.textContent?.slice(0, 120) || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "댓글을 남기지 못했습니다.");
      }

      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "댓글을 남기지 못했습니다.",
      );
    }
  }

  async function toggleResolved(thread: Thread) {
    try {
      const response = await fetch(`/api/comments/${thread.root.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: thread.root.resolvedAt ? "reopen" : "resolve",
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? "상태를 바꾸지 못했습니다.");
      }

      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "상태를 바꾸지 못했습니다.",
      );
    }
  }

  const threads = toThreads(comments).filter(
    (thread) => showResolved || !thread.root.resolvedAt,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-border flex items-center justify-between border-b px-3 py-2">
        <label className="flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(event) => setShowResolved(event.target.checked)}
          />
          해결된 댓글 보기
        </label>
        <Button
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="댓글 다시 불러오기"
          onClick={() => void refresh()}
          disabled={loading}
        >
          <RefreshCw
            aria-hidden
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {error ? (
          <p
            role="alert"
            className="border-danger/30 bg-danger/5 text-danger rounded-lg border px-3 py-2 text-xs"
          >
            {error}
          </p>
        ) : null}

        {loading && !comments.length ? (
          <p className="text-text-secondary flex items-center gap-2 py-10 text-center text-xs">
            <Loader2 aria-hidden className="size-3.5 animate-spin" />
            불러오는 중…
          </p>
        ) : null}

        {!threads.length && !loading ? (
          <p className="text-text-secondary py-10 text-center text-xs">
            아직 댓글이 없습니다. 문장에서 댓글을 남기거나 팀원과 의견을
            나눠보세요.
          </p>
        ) : null}

        {threads.map((thread) => (
          <ThreadCard
            key={thread.root.id}
            thread={thread}
            onReply={(content) =>
              void send({ content, parentCommentId: thread.root.id })
            }
            onToggleResolved={() => void toggleResolved(thread)}
          />
        ))}
      </div>

      <form
        className="border-border flex gap-2 border-t p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send({ content: body });
          setBody("");
        }}
      >
        <Input
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="댓글을 입력하세요"
        />
        <Button size="icon" type="submit" aria-label="댓글 추가">
          <Send aria-hidden className="size-4" />
        </Button>
      </form>
    </div>
  );
}

function ThreadCard({
  thread,
  onReply,
  onToggleResolved,
}: {
  thread: Thread;
  onReply: (content: string) => void;
  onToggleResolved: () => void;
}) {
  const [reply, setReply] = useState("");
  const resolved = !!thread.root.resolvedAt;

  return (
    <article
      className={`border-border rounded-xl border p-3 ${resolved ? "opacity-60" : ""}`}
      data-testid="comment-thread"
    >
      <div className="flex items-baseline justify-between">
        <p className="font-medium">{thread.root.authorName}</p>
        <time className="text-text-tertiary text-[11px]">
          {new Date(thread.root.createdAt).toLocaleString("ko-KR", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
      </div>

      {thread.root.anchorText ? (
        <p className="text-text-tertiary mt-1 truncate text-[11px]">
          연결 · {thread.root.anchorText}
        </p>
      ) : null}

      <p className="mt-2">{thread.root.content}</p>

      {thread.replies.map((item) => (
        <div key={item.id} className="bg-surface-subtle mt-2 rounded p-2 text-xs">
          <p className="font-medium">{item.authorName}</p>
          <p className="mt-1">{item.content}</p>
        </div>
      ))}

      <div className="mt-3 flex gap-2">
        <Input
          value={reply}
          onChange={(event) => setReply(event.target.value)}
          placeholder="답글"
          className="h-8 text-xs"
          onKeyDown={(event) => {
            if (event.key !== "Enter" || !reply.trim()) return;
            event.preventDefault();
            onReply(reply);
            setReply("");
          }}
        />
        <Button size="sm" variant="ghost" onClick={onToggleResolved}>
          {resolved ? "다시 열기" : "해결"}
        </Button>
      </div>
    </article>
  );
}
