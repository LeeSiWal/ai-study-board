"use client";

import {
  Check,
  CloudOff,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PanelLeft,
  Share2,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";

import { useDocumentSession, type SaveStatus } from "@/components/editor/document-session";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

import { useShell, type PanelKind } from "./shell-context";

/**
 * 공통 상단 바 — UI 명세 §6
 *
 * 왼쪽은 어디에 있는지, 오른쪽은 지금 어떤 상태인지를 알려준다.
 */

export interface Breadcrumb {
  id: string;
  title: string;
  href: string | null;
}

interface TopBarProps {
  breadcrumbs: Breadcrumb[];
  title: string;
}

export function TopBar({ breadcrumbs, title }: TopBarProps) {
  const { status, peers, title: sessionTitle } = useDocumentSession();
  const { openPanel, togglePanel, setSidebarOpen } = useShell();

  return (
    <header className="border-border bg-surface flex h-12 shrink-0 items-center gap-2 border-b px-3">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        aria-label="사이드바 열기"
        onClick={() => setSidebarOpen(true)}
      >
        <PanelLeft aria-hidden className="size-4" />
      </Button>

      <nav aria-label="상위 경로" className="flex min-w-0 items-center gap-1">
        {breadcrumbs.map((crumb) => (
          <Fragment key={crumb.id}>
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="text-text-secondary hover:text-foreground max-w-40 truncate"
              >
                {crumb.title}
              </Link>
            ) : (
              <span className="text-text-secondary max-w-40 truncate">
                {crumb.title}
              </span>
            )}
            <span aria-hidden className="text-text-tertiary">
              /
            </span>
          </Fragment>
        ))}
        <span className="truncate font-medium">{sessionTitle || title}</span>
      </nav>

      <div className="ml-auto flex items-center gap-1">
        <SaveStatusLabel status={status} />
        <PresenceStack peers={peers} />

        <Separator orientation="vertical" className="mx-1 !h-5" />

        <IconAction icon={Share2} label="공유" />
        <PanelToggle
          icon={MessageSquare}
          label="댓글"
          panel="comments"
          active={openPanel === "comments"}
          onToggle={togglePanel}
        />
        <PanelToggle
          icon={Sparkles}
          label="AI"
          panel="ai"
          active={openPanel === "ai"}
          onToggle={togglePanel}
        />
        <IconAction icon={MoreHorizontal} label="더보기" />
      </div>
    </header>
  );
}

/**
 * 저장 상태 — §6
 *
 * 공동 편집 문서에서 사용자가 직접 저장 버튼을 누르게 하지 않는다.
 * 저장 완료는 몇 초 뒤 조용한 표현으로 줄어드는 것이 명세지만, 지금은
 * 아이콘과 짧은 문구로 항상 같은 자리에 둔다.
 */
function SaveStatusLabel({ status }: { status: SaveStatus }) {
  const view = (() => {
    switch (status.kind) {
      case "connecting":
        return { icon: Loader2, text: "연결 중…", tone: "text-text-tertiary", spin: true };
      case "saving":
        return { icon: Loader2, text: "저장 중…", tone: "text-text-tertiary", spin: true };
      case "saved":
        return { icon: Check, text: "저장됨", tone: "text-success", spin: false };
      case "offline":
        return {
          icon: CloudOff,
          text: "오프라인 — 변경사항을 보관 중",
          tone: "text-warning",
          spin: false,
        };
      case "failed":
        return {
          icon: TriangleAlert,
          text: "동기화 실패",
          tone: "text-danger",
          spin: false,
        };
    }
  })();

  const Icon = view.icon;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          data-testid="save-status"
          className={cn("flex items-center gap-1.5 px-2 text-xs", view.tone)}
        >
          <Icon aria-hidden className={cn("size-3.5", view.spin && "animate-spin")} />
          <span className="hidden sm:inline">{view.text}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        {status.kind === "failed" ? status.reason : view.text}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * 접속자 — §6
 * 최대 4명까지 겹쳐 보여주고 나머지는 +N으로 접는다.
 */
function PresenceStack({
  peers,
}: {
  peers: { clientId: number; displayName: string; cursorColor: string }[];
}) {
  if (!peers.length) return null;

  const visible = peers.slice(0, 4);
  const overflow = peers.length - visible.length;

  return (
    <div
      className="flex items-center pl-1"
      data-testid="presence-stack"
      aria-label={`함께 보고 있는 사람 ${peers.length}명`}
    >
      {visible.map((peer) => (
        <Tooltip key={peer.clientId}>
          <TooltipTrigger asChild>
            <span
              className="border-surface -ml-1.5 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white first:ml-0"
              style={{ backgroundColor: peer.cursorColor }}
            >
              {peer.displayName.slice(0, 1)}
            </span>
          </TooltipTrigger>
          {/* 색만으로 사용자를 식별하지 않는다(§26) */}
          <TooltipContent>{peer.displayName} · 편집 중</TooltipContent>
        </Tooltip>
      ))}

      {overflow > 0 ? (
        <span className="border-surface bg-surface-subtle text-text-secondary -ml-1.5 flex size-6 items-center justify-center rounded-full border-2 text-[10px] font-semibold">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

function PanelToggle({
  icon: Icon,
  label,
  panel,
  active,
  onToggle,
}: {
  icon: typeof Sparkles;
  label: string;
  panel: PanelKind;
  active: boolean;
  onToggle: (panel: PanelKind) => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant={active ? "secondary" : "ghost"}
          size="icon"
          aria-label={label}
          aria-pressed={active}
          onClick={() => onToggle(panel)}
        >
          <Icon aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IconAction({ icon: Icon, label }: { icon: typeof Share2; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={label} disabled>
          <Icon aria-hidden className="size-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label} — 곧 제공됩니다.</TooltipContent>
    </Tooltip>
  );
}
