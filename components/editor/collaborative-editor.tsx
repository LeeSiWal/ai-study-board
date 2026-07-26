"use client";

import { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect, useState } from "react";
import * as Y from "yjs";

import { BlockId } from "./block-id";

/**
 * 실시간 공동 편집기.
 *
 * 문서 본문은 REST로 저장하지 않는다(아키텍처 §3.2). 본문의 유일한 출처는
 * Yjs 문서이고, 이 컴포넌트는 협업 서버의 Room에 붙어 변경분을 주고받는다.
 */

export interface EditorUser {
  displayName: string;
  cursorColor: string;
}

type ConnectionState =
  | { kind: "connecting" }
  | { kind: "connected"; synced: boolean }
  | { kind: "disconnected" }
  | { kind: "failed"; reason: string };

interface CollaborativeEditorProps {
  resourceId: string;
  documentName: string;
  currentUser: EditorUser;
  /**
   * 편집 권한. 협업 서버도 같은 판단으로 연결을 읽기 전용으로 만들지만,
   * 클라이언트에서도 막아야 한다. 그러지 않으면 사용자가 입력한 내용이
   * 화면에는 남고 서버에는 반영되지 않는 상태가 된다.
   */
  canEdit: boolean;
}

export function CollaborativeEditor({
  resourceId,
  documentName,
  currentUser,
  canEdit,
}: CollaborativeEditorProps) {
  const [provider, setProvider] = useState<HocuspocusProvider | null>(null);
  const [connection, setConnection] = useState<ConnectionState>({
    kind: "connecting",
  });

  useEffect(() => {
    const document = new Y.Doc();

    const instance = new HocuspocusProvider({
      url: process.env.NEXT_PUBLIC_COLLAB_URL ?? "ws://127.0.0.1:1234",
      name: documentName,
      document,

      // 토큰은 짧게 만료된다(아키텍처 §17). 함수로 넘기면 재연결할 때마다
      // 새로 발급받으므로 만료가 곧 연결 종료로 이어지지 않는다.
      token: async () => {
        const response = await fetch(
          `/api/resources/${resourceId}/collaboration-token`,
          { method: "POST" },
        );

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          throw new Error(body?.error ?? "협업 토큰을 발급받지 못했습니다.");
        }

        const body: { token: string } = await response.json();
        return body.token;
      },

      onStatus: ({ status }) => {
        setConnection((previous) =>
          status === "connected"
            ? {
                kind: "connected",
                synced: previous.kind === "connected" ? previous.synced : false,
              }
            : { kind: "disconnected" },
        );
      },

      onSynced: () => {
        setConnection({ kind: "connected", synced: true });
      },

      onAuthenticationFailed: ({ reason }) => {
        setConnection({ kind: "failed", reason });
      },
    });

    // 이 setState는 규칙이 경계하는 "파생 상태 계산"이 아니라 외부 시스템의
    // 핸들을 자식에게 노출하는 것이다. 렌더 중에 만들면 StrictMode의 이중
    // 호출에서 WebSocket이 하나 새고, 정리도 effect에서만 할 수 있다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProvider(instance);

    return () => {
      instance.destroy();
      document.destroy();
      setProvider(null);
    };
  }, [documentName, resourceId]);

  return (
    <div>
      <ConnectionBanner connection={connection} />
      {!canEdit ? (
        <p role="note">읽기 전용입니다. 이 페이지를 편집할 권한이 없습니다.</p>
      ) : null}
      {provider ? (
        <EditorSurface
          provider={provider}
          currentUser={currentUser}
          canEdit={canEdit}
        />
      ) : (
        <p>편집기를 준비하고 있습니다…</p>
      )}
    </div>
  );
}

function ConnectionBanner({ connection }: { connection: ConnectionState }) {
  const label = (() => {
    switch (connection.kind) {
      case "connecting":
        return "연결 중…";
      case "connected":
        return connection.synced ? "저장됨" : "동기화 중…";
      case "disconnected":
        return "오프라인 — 변경사항을 보관 중";
      case "failed":
        return `연결 거부됨: ${connection.reason}`;
    }
  })();

  return (
    <p data-testid="connection-status" style={{ margin: "0 0 12px" }}>
      {label}
    </p>
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

  if (!editor) return <p>편집기를 준비하고 있습니다…</p>;

  return <EditorContent editor={editor} data-testid="editor" />;
}
