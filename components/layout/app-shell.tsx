"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { ResourceNode } from "@/lib/store/resource-tree";

import { RightPanel } from "./right-panel";
import { ShellProvider, useShell } from "./shell-context";
import {
  WorkspaceSidebar,
  type SidebarViewer,
  type SidebarWorkspace,
} from "./workspace-sidebar";

/**
 * 글로벌 레이아웃 — UI 명세 §4
 *
 * 좌 240px / 메인 유동 / 우 360px. 1100px 아래에서는 우측 패널이 오버레이가
 * 되고, 1024px 아래에서는 좌측도 드로어가 된다.
 */

interface AppShellProps {
  workspace: SidebarWorkspace;
  viewer: SidebarViewer;
  tree: ResourceNode[];
  signOutAction: () => void;
  children: React.ReactNode;
}

export function AppShell(props: AppShellProps) {
  return (
    <ShellProvider>
      <ShellLayout {...props} />
    </ShellProvider>
  );
}

function ShellLayout({
  workspace,
  viewer,
  tree,
  signOutAction,
  children,
}: AppShellProps) {
  const { sidebarOpen, setSidebarOpen } = useShell();

  const sidebar = (
    <WorkspaceSidebar
      workspace={workspace}
      viewer={viewer}
      tree={tree}
      onSignOut={signOutAction}
    />
  );

  return (
    <div className="flex h-dvh overflow-hidden">
      <div className="border-border hidden w-60 shrink-0 border-r lg:block">
        {sidebar}
      </div>

      {/* 좁은 화면에서는 드로어로 연다(§4). */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">페이지 탐색</SheetTitle>
          {sidebar}
        </SheetContent>
      </Sheet>

      <div className="relative flex min-w-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">{children}</div>
        <RightPanel />
      </div>
    </div>
  );
}
