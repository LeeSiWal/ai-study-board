"use client";

import {
  Activity,
  ChevronsUpDown,
  CircleHelp,
  Home,
  LogOut,
  Plus,
  Search,
  Settings,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams, useSelectedLayoutSegments } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  findResourcePath,
  type ResourceNode,
} from "@/lib/store/resource-tree";

import { PageTree } from "./page-tree";

/**
 * 좌측 사이드바 — UI 명세 §5
 *
 * 위에서부터 워크스페이스 선택, 검색, 홈, 페이지 트리, 하단 메뉴 순이다.
 */

export interface SidebarViewer {
  displayName: string;
  email: string;
}

export interface SidebarWorkspace {
  id: string;
  name: string;
}

interface WorkspaceSidebarProps {
  workspace: SidebarWorkspace;
  viewer: SidebarViewer;
  tree: ResourceNode[];
  onSignOut: () => void;
}

export function WorkspaceSidebar({
  workspace,
  viewer,
  tree,
  onSignOut,
}: WorkspaceSidebarProps) {
  const { currentResourceId, isExpanded, toggle } = useTreeNavigation(tree);

  return (
    <div className="bg-sidebar flex h-full flex-col">
      <div className="space-y-1 p-2">
        <WorkspaceSwitcher
          workspace={workspace}
          viewer={viewer}
          onSignOut={onSignOut}
        />

        <SidebarAction icon={Search} label="검색" shortcut="⌘K" />
        <SidebarAction icon={Home} label="홈" href={`/w/${workspace.id}`} />
      </div>

      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <h2 className="text-text-tertiary text-xs font-medium">페이지</h2>
        <NewResourceMenu />
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <nav aria-label="페이지 트리" className="px-2 pb-2">
          <PageTree
            nodes={tree}
            workspaceId={workspace.id}
            currentResourceId={currentResourceId}
            isExpanded={isExpanded}
            onToggle={toggle}
          />
        </nav>
      </ScrollArea>

      <div className="border-sidebar-border space-y-1 border-t p-2">
        <SidebarAction
          icon={Users}
          label="멤버"
          href={`/w/${workspace.id}/settings/members`}
        />
        <SidebarAction
          icon={Activity}
          label="활동"
          href={`/w/${workspace.id}/activity`}
        />
        <SidebarAction
          icon={Settings}
          label="설정"
          href={`/w/${workspace.id}/settings/general`}
        />
        <SidebarAction icon={CircleHelp} label="도움말" />
      </div>
    </div>
  );
}

/**
 * 현재 페이지와 펼침 상태.
 *
 * 현재 리소스는 레이아웃이 알 수 없어(중첩 세그먼트의 param이라) URL에서
 * 직접 읽는다. 펼침은 사용자가 명시적으로 토글한 것만 기억하고, 나머지는
 * 현재 페이지의 조상인지로 정한다. 그래서 문서를 옮겨 다니면 해당 가지가
 * 저절로 열리고, 사용자가 접어 둔 가지는 다시 열리지 않는다.
 */
function useTreeNavigation(tree: ResourceNode[]) {
  const params = useParams<{ workspaceId: string }>();
  const segments = useSelectedLayoutSegments();

  // ["doc", "res-self-attention"] 또는 ["board", "..."] 형태.
  const currentResourceId = segments.length >= 2 ? segments[1] : null;

  const ancestors = useMemo(() => {
    if (!currentResourceId) return new Set<string>();

    const path = findResourcePath(tree, currentResourceId);
    // 마지막은 현재 페이지 자신이라 제외한다.
    return new Set(path.slice(0, -1).map((node) => node.id));
  }, [tree, currentResourceId]);

  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const isExpanded = (id: string) => overrides[id] ?? ancestors.has(id);

  const toggle = (id: string) =>
    setOverrides((current) => ({ ...current, [id]: !isExpanded(id) }));

  return { workspaceId: params.workspaceId, currentResourceId, isExpanded, toggle };
}

function WorkspaceSwitcher({
  workspace,
  viewer,
  onSignOut,
}: {
  workspace: SidebarWorkspace;
  viewer: SidebarViewer;
  onSignOut: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hover:bg-border/60 flex h-10 w-full items-center gap-2 rounded-lg px-2 text-left"
        >
          <span
            aria-hidden
            className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold"
          >
            {workspace.name.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate font-medium">
            {workspace.name}
          </span>
          <span className="sr-only" data-testid="current-user">
            {viewer.displayName}
          </span>
          <ChevronsUpDown
            aria-hidden
            className="text-text-tertiary size-4 shrink-0"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="font-medium">{viewer.displayName}</p>
          <p className="text-text-secondary text-xs">{viewer.email}</p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuLabel className="text-text-tertiary text-xs font-normal">
          워크스페이스
        </DropdownMenuLabel>
        <DropdownMenuItem className="gap-2">
          <span
            aria-hidden
            className="bg-primary text-primary-foreground flex size-5 items-center justify-center rounded text-[10px] font-semibold"
          >
            {workspace.name.slice(0, 1)}
          </span>
          {workspace.name}
        </DropdownMenuItem>
        <DropdownMenuItem disabled>워크스페이스 만들기</DropdownMenuItem>
        <DropdownMenuItem disabled>워크스페이스 설정</DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={onSignOut}>
          <LogOut aria-hidden className="size-4" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarAction({
  icon: Icon,
  label,
  href,
  shortcut,
}: {
  icon: typeof Home;
  label: string;
  href?: string;
  shortcut?: string;
}) {
  const content = (
    <>
      <Icon aria-hidden className="text-text-secondary size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {shortcut ? (
        <kbd className="text-text-tertiary text-[11px]">{shortcut}</kbd>
      ) : null}
    </>
  );

  const className =
    "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left hover:bg-border/60";

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  // 아직 동작하지 않는 항목은 클릭 가능한 것처럼 보이게 두지 않는다(§2).
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          disabled
          className={`${className} text-text-tertiary disabled:cursor-not-allowed`}
        >
          {content}
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">곧 제공됩니다.</TooltipContent>
    </Tooltip>
  );
}

function NewResourceMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-6"
          aria-label="새 페이지 만들기"
        >
          <Plus aria-hidden className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-48">
        {[
          "새 문서",
          "새 화이트보드",
          "파일 업로드",
          "새 폴더",
          "링크 추가",
        ].map((label) => (
          <DropdownMenuItem key={label} disabled className="justify-between">
            {label}
            <span className="text-text-tertiary text-[11px]">곧 제공</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
