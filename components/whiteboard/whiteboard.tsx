"use client";

import dynamic from "next/dynamic";

import type { WhiteboardScene } from "@/lib/contracts/whiteboard";

const WhiteboardCanvas = dynamic(
  () => import("./whiteboard-canvas").then((module) => module.WhiteboardCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-120 items-center justify-center rounded-xl border bg-surface-subtle">
        <p className="text-text-secondary text-sm">화이트보드를 불러오는 중…</p>
      </div>
    ),
  },
);

export function Whiteboard({
  resourceId,
  initialScene,
  canEdit,
}: {
  resourceId: string;
  initialScene: WhiteboardScene;
  canEdit: boolean;
}) {
  return (
    <WhiteboardCanvas
      resourceId={resourceId}
      initialScene={initialScene}
      canEdit={canEdit}
    />
  );
}
