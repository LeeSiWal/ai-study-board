import { z } from "zod";

/**
 * Excalidraw 장면의 서버 경계.
 *
 * 요소 스키마는 Excalidraw 버전에 따라 확장되므로 내부 필드는 라이브러리에
 * 맡기되, 최상위 구조와 요청 크기는 API에서 검증한다.
 */
export const whiteboardSceneSchema = z.object({
  elements: z.array(z.record(z.string(), z.unknown())).max(10_000),
  files: z.record(z.string(), z.unknown()),
  appState: z.object({
    viewBackgroundColor: z.string().max(64).optional(),
    gridSize: z.number().nullable().optional(),
  }),
});

export type WhiteboardScene = z.infer<typeof whiteboardSceneSchema>;

export const EMPTY_WHITEBOARD_SCENE: WhiteboardScene = {
  elements: [],
  files: {},
  appState: { viewBackgroundColor: "#ffffff", gridSize: 20 },
};
