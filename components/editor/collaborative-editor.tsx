"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import { Skeleton } from "@/components/ui/skeleton";

import { BlockId } from "./block-id";
import { useDocumentSession } from "./document-session";

/**
 * 실시간 공동 편집기 — UI 명세 §11
 *
 * 문서 본문은 REST로 저장하지 않는다(아키텍처 §3.2). 본문의 유일한 출처는
 * Yjs 문서이고, 연결은 DocumentSession이 소유한다.
 */

export interface EditorUser {
  displayName: string;
  cursorColor: string;
}

interface CollaborativeEditorProps {
  currentUser: EditorUser;
  /**
   * 편집 권한. 협업 서버도 같은 판단으로 연결을 읽기 전용으로 만들지만,
   * 클라이언트에서도 막아야 한다. 그러지 않으면 사용자가 입력한 내용이
   * 화면에는 남고 서버에는 반영되지 않는 상태가 된다.
   */
  canEdit: boolean;
}

export function CollaborativeEditor({
  currentUser,
  canEdit,
}: CollaborativeEditorProps) {
  const { provider } = useDocumentSession();

  if (!provider) return <EditorSkeleton />;

  return (
    <EditorSurface
      provider={provider}
      currentUser={currentUser}
      canEdit={canEdit}
    />
  );
}

/** 로딩 스피너보다 문서 골격을 먼저 보여준다(§24). */
function EditorSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-2/3" />
    </div>
  );
}

function EditorSurface({
  provider,
  currentUser,
  canEdit,
}: {
  provider: HocuspocusProvider;
  currentUser: EditorUser;
  canEdit: boolean;
}) {
  const editor = useEditor({
    // Next.js에서 SSR 시점에 즉시 렌더하면 하이드레이션이 어긋난다.
    immediatelyRender: false,
    editable: canEdit,
    editorProps: {
      attributes: {
        class: "doc-prose min-h-[60vh] outline-none",
        "data-testid": "editor",
      },
    },
    extensions: [
      // Collaboration이 Yjs의 실행 취소 이력을 관리하므로 StarterKit의
      // undoRedo는 꺼야 한다. 켜 두면 두 이력이 서로를 덮어쓴다.
      StarterKit.configure({ undoRedo: false }),
      Collaboration.configure({ document: provider.document }),
      CollaborationCaret.configure({
        provider,
        user: {
          name: currentUser.displayName,
          color: currentUser.cursorColor,
        },
      }),
      BlockId,
    ],
  });

  if (!editor) return <EditorSkeleton />;

  return <EditorContent editor={editor} />;
}
