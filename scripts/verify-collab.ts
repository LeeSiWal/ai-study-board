import { HocuspocusProvider } from "@hocuspocus/provider";
import WebSocket from "ws";
import * as Y from "yjs";

import { signCollaborationToken } from "../lib/collab/token";
import { documentNameForResource } from "../lib/contracts/collaboration";
import { PERMISSIONS_BY_ROLE } from "../lib/store/types";

/**
 * 브라우저 없이 협업 계층을 검증한다.
 *
 * Playwright가 시스템 라이브러리 때문에 막힐 때도 아래 세 가지는 확인할 수
 * 있다. 클라이언트 두 개를 실제 WebSocket으로 붙여 서버를 통과시킨다.
 *
 * 1. 서명된 협업 토큰으로 연결이 수립되는가
 * 2. 두 클라이언트의 변경이 CRDT로 병합되는가
 * 3. 위조·불일치 토큰이 거부되는가
 *
 * 실행: npm run verify:collab (협업 서버가 떠 있어야 한다)
 */

// Node 20에는 전역 WebSocket이 없다(Node 22부터 내장). 브라우저에서는 필요 없다.
if (!("WebSocket" in globalThis)) {
  (globalThis as { WebSocket?: unknown }).WebSocket = WebSocket;
}

const RESOURCE_ID = "res-self-attention";
const WORKSPACE_ID = "workspace-ai-papers";
const URL = process.env.COLLAB_INTERNAL_URL ?? `ws://127.0.0.1:${process.env.COLLAB_PORT ?? 7172}`;
const DOCUMENT_NAME = documentNameForResource(RESOURCE_ID);

interface Client {
  provider: HocuspocusProvider;
  document: Y.Doc;
}

function connect(
  displayName: string,
  userId: string,
  cursorColor: string,
  permissions: typeof PERMISSIONS_BY_ROLE.MEMBER,
  resourceIdInToken = RESOURCE_ID,
): Client {
  const document = new Y.Doc();

  // url을 직접 주면 provider가 자기 소켓을 만든다. 클라이언트마다 별도
  // 연결이 되어야 서버가 서로 다른 사용자로 인식한다.
  const provider = new HocuspocusProvider({
    url: URL,
    name: DOCUMENT_NAME,
    document,
    token: async () =>
      signCollaborationToken({
        userId,
        displayName,
        cursorColor,
        workspaceId: WORKSPACE_ID,
        resourceId: resourceIdInToken,
        permissions,
      }),
  });

  return { provider, document };
}

function waitForSync(client: Client, label: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} 동기화 시간 초과`)),
      10_000,
    );

    client.provider.on("synced", () => {
      clearTimeout(timer);
      resolve();
    });

    client.provider.on("authenticationFailed", ({ reason }: { reason: string }) => {
      clearTimeout(timer);
      reject(new Error(`${label} 인증 실패: ${reason}`));
    });
  });
}

function waitUntil(
  predicate: () => boolean,
  label: string,
  timeoutMs = 10_000,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();

    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error(`${label} 시간 초과`));
      }
      setTimeout(tick, 100);
    };

    tick();
  });
}

function destroy(client: Client) {
  client.provider.destroy();
  client.document.destroy();
}

const results: string[] = [];

function pass(message: string) {
  results.push(`  ✓ ${message}`);
}

async function checkCollaboration() {
  const siwol = connect(
    "시월",
    "user-siwol",
    "#4F67E8",
    PERMISSIONS_BY_ROLE.OWNER,
  );
  const minji = connect(
    "민지",
    "user-minji",
    "#218A61",
    PERMISSIONS_BY_ROLE.ADMIN,
  );

  try {
    await Promise.all([
      waitForSync(siwol, "시월"),
      waitForSync(minji, "민지"),
    ]);
    pass("서명된 토큰으로 두 클라이언트가 연결되었다");

    const marker = `시월-${Date.now()}`;
    siwol.document.getText("verify").insert(0, marker);

    await waitUntil(
      () => minji.document.getText("verify").toString().includes(marker),
      "시월 → 민지 전파",
    );
    pass("시월의 변경이 민지에게 전파되었다");

    const reply = `민지-${Date.now()}`;
    minji.document.getText("verify").insert(0, reply);

    await waitUntil(
      () => siwol.document.getText("verify").toString().includes(reply),
      "민지 → 시월 전파",
    );
    pass("민지의 변경이 시월에게 전파되었다");

    // 양쪽이 같은 최종 상태로 수렴해야 한다. CRDT의 핵심 성질이다.
    await waitUntil(
      () =>
        siwol.document.getText("verify").toString() ===
        minji.document.getText("verify").toString(),
      "최종 상태 수렴",
    );
    pass("두 문서가 동일한 최종 상태로 수렴했다");
  } finally {
    destroy(siwol);
    destroy(minji);
  }
}

async function checkTokenForWrongDocument() {
  // 다른 문서용으로 발급된 토큰으로 이 Room에 붙으려 시도한다.
  const intruder = connect(
    "침입자",
    "user-taeho",
    "#6756D8",
    PERMISSIONS_BY_ROLE.MEMBER,
    "res-transformer-overview",
  );

  try {
    await waitForSync(intruder, "침입자");
    throw new Error("다른 문서용 토큰이 수락되었다 — 경계가 새고 있다");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes("인증 실패") || message.includes("시간 초과")) {
      pass("다른 문서용 토큰은 거부되었다");
      return;
    }

    throw error;
  } finally {
    destroy(intruder);
  }
}

async function main() {
  console.log(`협업 계층 검증 → ${URL} (${DOCUMENT_NAME})\n`);

  await checkCollaboration();
  await checkTokenForWrongDocument();

  console.log(results.join("\n"));
  console.log(`\n${results.length}개 확인 완료.`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(results.join("\n"));
    console.error(`\n실패: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  });
