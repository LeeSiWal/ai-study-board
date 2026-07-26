"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { useDocumentSession } from "./document-session";

interface DocumentTitleProps {
  resourceId: string;
  initialTitle: string;
  canEdit: boolean;
}

export function DocumentTitle({
  resourceId,
  initialTitle,
  canEdit,
}: DocumentTitleProps) {
  const router = useRouter();
  const { setTitle: setSessionTitle } = useDocumentSession();
  const [title, setTitle] = useState(initialTitle);
  const [savedTitle, setSavedTitle] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);

  async function saveTitle() {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setTitle(savedTitle);
      setError("제목은 비워둘 수 없습니다.");
      return;
    }
    if (nextTitle === savedTitle) return;

    const currentRequest = ++requestId.current;
    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/resources/${resourceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(body?.error ?? "제목을 저장하지 못했습니다.");
      }
      if (currentRequest !== requestId.current) return;

      setTitle(body.title);
      setSavedTitle(body.title);
      setSessionTitle(body.title);
      router.refresh();
    } catch (cause) {
      if (currentRequest !== requestId.current) return;
      setError(
        cause instanceof Error ? cause.message : "제목을 저장하지 못했습니다.",
      );
    } finally {
      if (currentRequest === requestId.current) setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <h1 className="text-[32px] leading-tight font-semibold">{initialTitle}</h1>
    );
  }

  return (
    <div>
      <input
        aria-label="문서 제목"
        data-testid="document-title"
        value={title}
        maxLength={120}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={saveTitle}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
          if (event.key === "Escape") {
            setTitle(savedTitle);
            event.currentTarget.blur();
          }
        }}
        className="w-full rounded-sm bg-transparent text-[32px] leading-tight font-semibold outline-none placeholder:text-text-tertiary"
      />
      <p className="mt-1 min-h-4 text-xs" aria-live="polite">
        {error ? (
          <span className="text-danger">{error}</span>
        ) : saving ? (
          <span className="text-text-tertiary">제목 저장 중…</span>
        ) : null}
      </p>
    </div>
  );
}
