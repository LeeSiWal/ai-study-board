"use client";

import type { HocuspocusProvider } from "@hocuspocus/provider";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import type { Editor } from "@tiptap/core";
import Mathematics from "@tiptap/extension-mathematics";
import { TableKit } from "@tiptap/extension-table";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Strikethrough,
  ListChecks,
  Table2,
  Sigma,
} from "lucide-react";
import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { useShell } from "@/components/layout/shell-context";
import { cn } from "@/lib/utils";

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
  const { setEditor } = useShell();
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
      TaskList,
      TaskItem.configure({ nested: true }),
      TableKit.configure({ table: { resizable: true } }),
      Mathematics,
    ],
  });

  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  if (!editor) return <EditorSkeleton />;

  return (
    <div className="relative">
      {canEdit ? <SelectionToolbar editor={editor} /> : null}
      {canEdit ? <SlashCommandMenu editor={editor} /> : null}
      <EditorContent editor={editor} />
      {canEdit ? (
        <p className="text-text-tertiary mt-8 border-t pt-3 text-xs">
          빈 블록에서 <kbd className="rounded border px-1 py-0.5">/</kbd>를
          입력하면 블록 메뉴가 열립니다.
        </p>
      ) : null}
    </div>
  );
}

function SelectionToolbar({ editor }: { editor: Editor }) {
  const actions = [
    {
      label: "굵게",
      icon: Bold,
      active: () => editor.isActive("bold"),
      run: () => editor.chain().focus().toggleBold().run(),
    },
    {
      label: "기울임",
      icon: Italic,
      active: () => editor.isActive("italic"),
      run: () => editor.chain().focus().toggleItalic().run(),
    },
    {
      label: "취소선",
      icon: Strikethrough,
      active: () => editor.isActive("strike"),
      run: () => editor.chain().focus().toggleStrike().run(),
    },
    {
      label: "인라인 코드",
      icon: Code,
      active: () => editor.isActive("code"),
      run: () => editor.chain().focus().toggleCode().run(),
    },
  ];

  return (
    <BubbleMenu
      editor={editor}
      shouldShow={({ editor: current }) =>
        current.isEditable && !current.state.selection.empty
      }
      options={{ placement: "top" }}
      className="border-border bg-surface flex items-center gap-0.5 rounded-lg border p-1 shadow-lg"
    >
      {actions.map(({ label, icon: Icon, active, run }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          aria-pressed={active()}
          onClick={run}
          className={cn(
            "hover:bg-surface-subtle rounded-md p-1.5",
            active() && "bg-primary-soft text-primary",
          )}
        >
          <Icon aria-hidden className="size-4" />
        </button>
      ))}
    </BubbleMenu>
  );
}

interface SlashState {
  query: string;
  from: number;
  to: number;
  left: number;
  top: number;
}

function SlashCommandMenu({ editor }: { editor: Editor }) {
  const [state, setState] = useState<SlashState | null>(null);

  useEffect(() => {
    const update = () => {
      const { $from, empty } = editor.state.selection;
      if (!empty || !$from.parent.isTextblock) {
        setState(null);
        return;
      }

      const from = $from.start();
      const typed = editor.state.doc.textBetween(from, $from.pos, "\n", "\0");
      if (!typed.startsWith("/") || typed.includes(" ")) {
        setState(null);
        return;
      }

      const coords = editor.view.coordsAtPos($from.pos);
      const parent = editor.view.dom.getBoundingClientRect();
      setState({
        query: typed.slice(1).toLowerCase(),
        from,
        to: $from.pos,
        left: Math.max(0, coords.left - parent.left),
        top: coords.bottom - parent.top + 6,
      });
    };

    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
    };
  }, [editor]);

  const commands = [
    {
      label: "본문",
      keywords: "paragraph text 본문 문단",
      icon: Pilcrow,
      run: () => editor.chain().setParagraph().run(),
    },
    {
      label: "제목 2",
      keywords: "heading h2 제목",
      icon: Heading2,
      run: () => editor.chain().toggleHeading({ level: 2 }).run(),
    },
    {
      label: "제목 3",
      keywords: "heading h3 제목",
      icon: Heading3,
      run: () => editor.chain().toggleHeading({ level: 3 }).run(),
    },
    {
      label: "글머리 목록",
      keywords: "bullet list 글머리 목록",
      icon: List,
      run: () => editor.chain().toggleBulletList().run(),
    },
    {
      label: "번호 목록",
      keywords: "ordered number list 번호 목록",
      icon: ListOrdered,
      run: () => editor.chain().toggleOrderedList().run(),
    },
    {
      label: "할 일 목록",
      keywords: "task todo check 할일 할 일 목록",
      icon: ListChecks,
      run: () => editor.chain().toggleTaskList().run(),
    },
    {
      label: "표",
      keywords: "table grid 표",
      icon: Table2,
      run: () =>
        editor
          .chain()
          .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
          .run(),
    },
    {
      label: "수식",
      keywords: "math formula latex 수식",
      icon: Sigma,
      run: () =>
        editor
          .chain()
          .insertBlockMath({ latex: "\\\\mathrm{softmax}(QK^T/\\\\sqrt{d_k})V" })
          .run(),
    },
    {
      label: "인용",
      keywords: "quote blockquote 인용",
      icon: Quote,
      run: () => editor.chain().toggleBlockquote().run(),
    },
    {
      label: "코드 블록",
      keywords: "code block 코드",
      icon: Code,
      run: () => editor.chain().toggleCodeBlock().run(),
    },
    {
      label: "구분선",
      keywords: "divider horizontal rule 구분선",
      icon: Minus,
      run: () => editor.chain().setHorizontalRule().run(),
    },
  ].filter((command) => command.keywords.includes(state?.query ?? ""));

  if (!state || commands.length === 0) return null;

  return (
    <div
      role="menu"
      aria-label="블록 추가"
      data-testid="slash-command-menu"
      style={{ left: state.left, top: state.top }}
      className="border-border bg-surface absolute z-20 w-56 rounded-xl border p-1.5 shadow-xl"
    >
      <p className="text-text-tertiary px-2 py-1 text-[11px] font-medium">
        블록 추가
      </p>
      {commands.map(({ label, icon: Icon, run }) => (
        <button
          key={label}
          type="button"
          role="menuitem"
          onMouseDown={(event) => {
            event.preventDefault();
            editor
              .chain()
              .focus()
              .deleteRange({ from: state.from, to: state.to })
              .run();
            run();
            setState(null);
          }}
          className="hover:bg-surface-subtle flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left"
        >
          <span className="border-border bg-surface-subtle flex size-7 items-center justify-center rounded-md border">
            <Icon aria-hidden className="size-4" />
          </span>
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
