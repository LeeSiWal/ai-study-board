"use client";

import {
  Excalidraw,
  MainMenu,
  WelcomeScreen,
  convertToExcalidrawElements,
  serializeAsJSON,
} from "@excalidraw/excalidraw";
import type {
  AppState,
  BinaryFiles,
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import { Check, CloudOff, Loader2, StickyNote, TriangleAlert } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { WhiteboardScene } from "@/lib/contracts/whiteboard";
import { cn } from "@/lib/utils";

import "@excalidraw/excalidraw/index.css";

type SaveState = "saved" | "saving" | "offline" | "failed";

const SAVE_DELAY = 900;

export function WhiteboardCanvas({
  resourceId,
  initialScene,
  canEdit,
}: {
  resourceId: string;
  initialScene: WhiteboardScene;
  canEdit: boolean;
}) {
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestScene = useRef<WhiteboardScene | null>(null);
  const lastSceneJson = useRef(JSON.stringify(initialScene));
  const mounted = useRef(true);

  const save = useCallback(async (scene: WhiteboardScene) => {
    if (!navigator.onLine) {
      setSaveState("offline");
      return;
    }

    setSaveState("saving");
    try {
      const response = await fetch(`/api/resources/${resourceId}/whiteboard`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(scene),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error ?? "화이트보드를 저장하지 못했습니다.");
      }
      if (mounted.current) setSaveState("saved");
    } catch {
      if (mounted.current) setSaveState(navigator.onLine ? "failed" : "offline");
    }
  }, [resourceId]);

  useEffect(() => {
    mounted.current = true;
    const handleOnline = () => {
      if (latestScene.current) void save(latestScene.current);
    };
    const handleOffline = () => setSaveState("offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      mounted.current = false;
      if (timeout.current) clearTimeout(timeout.current);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [save]);

  const handleChange = useCallback((
    elements: readonly ExcalidrawElement[],
    appState: AppState,
    files: BinaryFiles,
  ) => {
    if (!canEdit) return;

    // serializeAsJSON이 Excalidraw 전용 필드와 이미지 파일을 안전하게 정리한다.
    const serialized = serializeAsJSON(elements, appState, files, "database");
    const parsed = JSON.parse(serialized) as {
      elements: WhiteboardScene["elements"];
      files: WhiteboardScene["files"];
      appState: Record<string, unknown>;
    };
    const scene: WhiteboardScene = {
      elements: parsed.elements,
      // serializeAsJSON은 이미지가 없으면 files 키 자체를 생략한다.
      files: parsed.files ?? {},
      appState: {
        viewBackgroundColor:
          typeof parsed.appState.viewBackgroundColor === "string"
            ? parsed.appState.viewBackgroundColor
            : "#ffffff",
        gridSize:
          typeof parsed.appState.gridSize === "number"
            ? parsed.appState.gridSize
            : null,
      },
    };
    const sceneJson = JSON.stringify(scene);

    // Excalidraw는 선택·포인터 이동 같은 개인 UI 변화에도 onChange를 호출한다.
    // 공유 장면이 같으면 저장 타이머와 상태를 건드리지 않는다.
    if (sceneJson === lastSceneJson.current) return;
    lastSceneJson.current = sceneJson;

    latestScene.current = scene;
    setSaveState(navigator.onLine ? "saving" : "offline");
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = setTimeout(() => void save(scene), SAVE_DELAY);
  }, [canEdit, save]);

  const initialData: ExcalidrawInitialDataState = {
    elements: initialScene.elements as unknown as ExcalidrawInitialDataState["elements"],
    files: initialScene.files as unknown as BinaryFiles,
    appState: {
      viewBackgroundColor: initialScene.appState.viewBackgroundColor ?? "#ffffff",
      gridSize: initialScene.appState.gridSize ?? 20,
    },
    scrollToContent: true,
  };

  const addStickyNote = () => {
    if (!api || !canEdit) return;

    const appState = api.getAppState();
    const width = 220;
    const height = 150;
    const x = -appState.scrollX + (appState.width / appState.zoom.value - width) / 2;
    const y = -appState.scrollY + (appState.height / appState.zoom.value - height) / 2;
    const created = convertToExcalidrawElements([
      {
        type: "rectangle",
        x,
        y,
        width,
        height,
        backgroundColor: "#fff3bf",
        strokeColor: "#f08c00",
        fillStyle: "solid",
        roundness: { type: 3 },
      },
      {
        type: "text",
        x: x + 20,
        y: y + 22,
        width: width - 40,
        height: height - 44,
        text: "새 메모",
        fontSize: 22,
        strokeColor: "#5f3d00",
      },
    ], { regenerateIds: true });

    api.updateScene({
      elements: [...api.getSceneElements(), ...created],
    });
    api.scrollToContent(created, { fitToContent: false, animate: true });
  };

  return (
    <div className="relative h-full min-h-[calc(100vh-7rem)] overflow-hidden rounded-xl border bg-white">
      <Excalidraw
        initialData={initialData}
        excalidrawAPI={setApi}
        onChange={handleChange}
        viewModeEnabled={!canEdit}
        langCode="ko-KR"
        name="AI 스터디 화이트보드"
        UIOptions={{
          canvasActions: {
            saveToActiveFile: false,
            loadScene: true,
            export: { saveFileToDisk: true },
          },
        }}
      >
        <MainMenu>
          <MainMenu.DefaultItems.LoadScene />
          <MainMenu.DefaultItems.SaveAsImage />
          <MainMenu.DefaultItems.Export />
          <MainMenu.DefaultItems.ClearCanvas />
          <MainMenu.Separator />
          <MainMenu.DefaultItems.ToggleTheme />
          <MainMenu.DefaultItems.ChangeCanvasBackground />
        </MainMenu>
        <WelcomeScreen>
          <WelcomeScreen.Hints.MenuHint />
          <WelcomeScreen.Hints.ToolbarHint />
          <WelcomeScreen.Center>
            <WelcomeScreen.Center.Heading>
              아이디어를 함께 그려보세요
            </WelcomeScreen.Center.Heading>
            <WelcomeScreen.Center.Menu>
              <WelcomeScreen.Center.MenuItemHelp />
            </WelcomeScreen.Center.Menu>
          </WelcomeScreen.Center>
        </WelcomeScreen>
      </Excalidraw>

      {canEdit ? (
        <button
          type="button"
          onClick={addStickyNote}
          aria-label="포스트잇 추가"
          className="absolute top-3 right-44 z-10 flex items-center gap-1.5 rounded-lg border bg-white px-2.5 py-2 text-xs font-medium shadow-sm hover:bg-amber-50"
        >
          <StickyNote className="size-4 text-amber-600" />
          포스트잇
        </button>
      ) : null}
      <SaveIndicator state={saveState} />
      {!canEdit ? (
        <p className="absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-white/95 px-3 py-1.5 text-xs shadow-sm">
          읽기 전용 화이트보드입니다.
        </p>
      ) : null}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const view = {
    saved: { icon: Check, label: "저장됨", color: "text-success", spin: false },
    saving: { icon: Loader2, label: "저장 중…", color: "text-text-secondary", spin: true },
    offline: { icon: CloudOff, label: "오프라인", color: "text-warning", spin: false },
    failed: { icon: TriangleAlert, label: "저장 실패", color: "text-danger", spin: false },
  }[state];
  const Icon = view.icon;

  return (
    <div
      data-testid="whiteboard-save-status"
      className={cn(
        "absolute right-3 bottom-3 z-10 flex items-center gap-1.5 rounded-full border bg-white/95 px-3 py-1.5 text-xs shadow-sm",
        view.color,
      )}
    >
      <Icon className={cn("size-3.5", view.spin && "animate-spin")} />
      {view.label}
    </div>
  );
}
