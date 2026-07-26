import { HocuspocusProvider } from "@hocuspocus/provider";
import WebSocket from "ws";
import * as Y from "yjs";

import { signCollaborationToken } from "../collab/token";
import { documentNameForResource } from "../contracts/collaboration";
import type { DocumentBlock } from "../contracts/ai";
import { PERMISSIONS_BY_ROLE } from "../store/types";

/**
 * 문서 본문을 협업 서버에서 읽는다 — 아키텍처 §15.4
 *
 * 본문은 PostgreSQL이 아니라 CRDT에 있다(§3.1). 그래서 MCP 서버가 문서를
 * 읽으려면 다른 클라이언트와 똑같이 협업 서버에 붙어야 한다. REST로 본문을
 * 꺼내는 경로를 새로 만들면 §3.2가 금지한 두 번째 출처가 생긴다.
 *
 * `read_page`가 blockId를 함께 돌려주는 것이 중요하다. 그게 없으면 외부
 * AI는 수정 대상을 지목할 수 없다.
 */

// Node 20에는 전역 WebSocket이 없다(Node 22부터 내장).
if (!("WebSocket" in globalThis)) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const CONNECT_TIMEOUT_MS = 10_000;

/**
 * 서버 간 연결이라 항상 루프백이다.
 *
 * 브라우저가 쓰는 NEXT_PUBLIC_COLLAB_URL을 쓰면 안 된다. 그건 터널 주소일 수
 * 있어서 굳이 밖으로 나갔다 돌아온다. 포트는 협업 서버가 실제로 듣는 값을
 * 그대로 따라간다 — 하드코딩하면 포트를 옮길 때 조용히 끊긴다.
 */
function collaborationUrl(): string {
  const port = process.env.COLLAB_PORT ?? "7172";
  return process.env.COLLAB_INTERNAL_URL ?? `ws://127.0.0.1:${port}`;
}

/**
 * Tiptap 문서의 최상위 노드를 블록으로 펼친다.
 *
 * Yjs XmlFragment를 직접 읽으므로 편집기 없이도 동작한다. blockId는
 * BlockId 확장이 노드 속성으로 심어 둔 값이다.
 */
function toBlocks(fragment: Y.XmlFragment): DocumentBlock[] {
  const blocks: DocumentBlock[] = [];

  for (const child of fragment.toArray()) {
    if (!(child instanceof Y.XmlElement)) continue;

    const blockId = child.getAttribute("blockId");
    if (typeof blockId !== "string" || !blockId) continue;

    blocks.push({
      blockId,
      type: child.nodeName,
      text: child.toString().replace(/<[^>]*>/g, ""),
    });
  }

  return blocks;
}

/**
 * 문서를 한 번 읽고 연결을 끊는다.
 *
 * 오래 붙어 있으면 접속자 목록에 유령이 남는다. MCP 호출은 단발이므로
 * 읽고 바로 나간다.
 */
export async function readDocumentBlocks(
  resourceId: string,
  workspaceId: string,
  userId: string,
  displayName: string,
): Promise<DocumentBlock[]> {
  const document = new Y.Doc();

  const provider = new HocuspocusProvider({
    url: collaborationUrl(),
    name: documentNameForResource(resourceId),
    document,
    // 읽기만 하므로 편집 권한을 요청하지 않는다.
    token: async () =>
      signCollaborationToken({
        userId,
        displayName,
        cursorColor: "#929aa5",
        workspaceId,
        resourceId,
        permissions: PERMISSIONS_BY_ROLE.GUEST,
      }),
  });

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("협업 서버 응답이 없습니다.")),
        CONNECT_TIMEOUT_MS,
      );

      provider.on("synced", () => {
        clearTimeout(timer);
        resolve();
      });

      provider.on("authenticationFailed", ({ reason }: { reason: string }) => {
        clearTimeout(timer);
        reject(new Error(`협업 서버 인증 실패: ${reason}`));
      });
    });

    return toBlocks(document.getXmlFragment("default"));
  } finally {
    provider.destroy();
    document.destroy();
  }
}
