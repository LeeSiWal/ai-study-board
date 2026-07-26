"use client";

import {
  ChevronRight,
  FileText,
  Folder,
  Link2,
  Paperclip,
  PenLine,
} from "lucide-react";
import Link from "next/link";

import type { ResourceNode } from "@/lib/store/resource-tree";
import type { ResourceType } from "@/lib/store/types";
import { cn } from "@/lib/utils";

/**
 * 페이지 트리 — UI 명세 §5
 *
 * 문서·화이트보드·파일이 한 트리에 섞여 있고 타입은 아이콘으로 구분한다.
 * 펼침 상태는 사이드바가 소유한다. 그래야 문서를 옮겨 다닐 때 현재 페이지의
 * 조상이 자동으로 펼쳐지면서도 사용자가 접어 둔 가지는 그대로 남는다.
 */

const ICONS: Record<ResourceType, typeof FileText> = {
  DOCUMENT: FileText,
  WHITEBOARD: PenLine,
  FILE: Paperclip,
  FOLDER: Folder,
  LINK: Link2,
};

/** 아직 화면이 없는 타입은 링크 대신 비활성으로 둔다(§2). */
const ROUTED_TYPES: Partial<Record<ResourceType, string>> = {
  DOCUMENT: "doc",
};

interface PageTreeProps {
  nodes: ResourceNode[];
  workspaceId: string;
  currentResourceId: string | null;
  isExpanded: (id: string) => boolean;
  onToggle: (id: string) => void;
  depth?: number;
}

export function PageTree({ nodes, depth = 0, ...rest }: PageTreeProps) {
  if (!nodes.length) return null;

  return (
    <ul className="space-y-px">
      {nodes.map((node) => (
        <PageTreeRow key={node.id} node={node} depth={depth} {...rest} />
      ))}
    </ul>
  );
}

function PageTreeRow({
  node,
  workspaceId,
  currentResourceId,
  isExpanded,
  onToggle,
  depth = 0,
}: Omit<PageTreeProps, "nodes"> & { node: ResourceNode }) {
  const Icon = ICONS[node.type];
  const segment = ROUTED_TYPES[node.type];
  const isCurrent = node.id === currentResourceId;
  const hasChildren = node.children.length > 0;
  const expanded = hasChildren && isExpanded(node.id);

  // 들여쓰기는 패딩으로 준다. 중첩 목록을 쓰면 행의 클릭 영역이 좁아진다.
  const indent = { paddingLeft: `${depth * 12 + 8}px` };

  const rowClass = cn(
    "flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded-md pr-1 text-left",
    isCurrent
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-foreground hover:bg-border/50",
  );

  const label = (
    <>
      {node.icon ? (
        <span aria-hidden className="w-4 shrink-0 text-center text-[13px]">
          {node.icon}
        </span>
      ) : (
        <Icon
          aria-hidden
          className={cn(
            "size-4 shrink-0",
            isCurrent ? "text-sidebar-accent-foreground" : "text-text-tertiary",
          )}
        />
      )}
      <span className="truncate">{node.title}</span>
    </>
  );

  return (
    <li>
      <div className="flex items-center" style={indent}>
        {hasChildren ? (
          <button
            type="button"
            aria-label={`${node.title} ${expanded ? "접기" : "펼치기"}`}
            aria-expanded={expanded}
            onClick={() => onToggle(node.id)}
            className="hover:bg-border/60 mr-px flex size-4 shrink-0 items-center justify-center rounded"
          >
            <ChevronRight
              aria-hidden
              className={cn(
                "text-text-tertiary size-3.5 transition-transform duration-150",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <span aria-hidden className="mr-px size-4 shrink-0" />
        )}

        {segment ? (
          <Link
            href={`/w/${workspaceId}/${segment}/${node.id}`}
            aria-current={isCurrent ? "page" : undefined}
            className={rowClass}
          >
            {label}
          </Link>
        ) : (
          // 클릭 가능한 것처럼 보이지만 반응 없는 요소를 만들지 않는다(§2).
          <span
            title="이 타입의 화면은 아직 준비 중입니다."
            className={cn(rowClass, "text-text-tertiary cursor-default")}
          >
            {label}
            <span className="text-text-tertiary ml-auto shrink-0 text-[10px]">
              곧
            </span>
          </span>
        )}
      </div>

      {expanded ? (
        <PageTree
          nodes={node.children}
          workspaceId={workspaceId}
          currentResourceId={currentResourceId}
          isExpanded={isExpanded}
          onToggle={onToggle}
          depth={depth + 1}
        />
      ) : null}
    </li>
  );
}
