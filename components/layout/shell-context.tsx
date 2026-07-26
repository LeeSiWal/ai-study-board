"use client";

import { createContext, useContext, useMemo, useState } from "react";

/**
 * 셸 상태 — UI 명세 §4
 *
 * 우측 패널은 한 번에 하나만 열린다. 좁은 화면에서는 좌측 사이드바가
 * 드로어가 된다.
 *
 * 상단 바의 버튼과 실제 패널·사이드바는 서로 다른 서브트리에 있어서
 * 셸이 컨텍스트로 상태를 공유한다.
 */

export type PanelKind = "ai" | "comments" | "info" | "activity";

interface ShellState {
  openPanel: PanelKind | null;
  /** 같은 패널을 다시 누르면 닫힌다. */
  togglePanel: (panel: PanelKind) => void;
  closePanel: () => void;

  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

const ShellContext = createContext<ShellState | null>(null);

export function ShellProvider({ children }: { children: React.ReactNode }) {
  const [openPanel, setOpenPanel] = useState<PanelKind | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const value = useMemo<ShellState>(
    () => ({
      openPanel,
      togglePanel: (panel) =>
        setOpenPanel((current) => (current === panel ? null : panel)),
      closePanel: () => setOpenPanel(null),
      sidebarOpen,
      setSidebarOpen,
    }),
    [openPanel, sidebarOpen],
  );

  return <ShellContext value={value}>{children}</ShellContext>;
}

export function useShell(): ShellState {
  const value = useContext(ShellContext);

  if (!value) {
    throw new Error("useShell은 AppShell 안에서만 쓸 수 있습니다.");
  }

  return value;
}
