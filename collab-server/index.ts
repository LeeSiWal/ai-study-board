import { Server } from "@hocuspocus/server";

import { verifyCollaborationToken } from "../lib/collab/token";
import { resourceIdFromDocumentName } from "../lib/contracts/collaboration";
import { getVersion, loadDocument, storeDocument } from "./document-storage";

/**
 * Hocuspocus 협업 서버.
 *
 * Next.js 앱과 별도 프로세스로 돈다. 아키텍처 §19가 협업 엔진을 분리한
 * 이유(연결 수명과 메모리 상태가 일반 API와 다름)를 프로토타입에서도 지킨다.
 *
 * 이 서버는 사용자 데이터베이스를 보지 않는다. 권한 판정은 Next.js API가
 * 이미 끝냈고, 여기서는 서명된 토큰만 검증한다.
 */

const PORT = Number(process.env.COLLAB_PORT ?? 1234);

/** onAuthenticate가 돌려준 값이 이후 훅의 context로 들어온다. */
interface ConnectionContext {
  userId: string;
  displayName: string;
  canEdit: boolean;
}

const server = new Server({
  port: PORT,
  name: "ai-study-collab",

  async onAuthenticate({ token, documentName, connectionConfig }) {
    const resourceId = resourceIdFromDocumentName(documentName);

    if (!resourceId) {
      throw new Error(`알 수 없는 Room 이름입니다: ${documentName}`);
    }

    // 서명·만료·형식이 어긋나면 여기서 throw 되고 연결이 거부된다.
    const claims = await verifyCollaborationToken(token);

    // 토큰이 가리키는 리소스와 실제 접속하려는 Room이 같아야 한다.
    // 이 검사가 없으면 A 문서 토큰으로 B 문서에 붙을 수 있다.
    if (claims.resourceId !== resourceId) {
      throw new Error("토큰이 이 문서에 대한 것이 아닙니다.");
    }

    // 편집 권한이 없으면 연결은 허용하되 쓰기를 막는다. UI 명세 §2가 말한
    // "권한 없는 작업은 숨기지 말고 이유를 설명한다"를 서버에서 뒷받침한다.
    const canEdit = claims.permissions.includes("edit");
    connectionConfig.readOnly = !canEdit;

    const context: ConnectionContext = {
      userId: claims.userId,
      displayName: claims.displayName,
      canEdit,
    };

    console.log(
      `[collab] 연결 ${claims.displayName} → ${documentName} (${canEdit ? "편집" : "읽기 전용"})`,
    );

    return context;
  },

  async onLoadDocument({ documentName, document }) {
    loadDocument(documentName, document);
    return document;
  },

  async onStoreDocument({ documentName, document }) {
    const version = storeDocument(documentName, document);
    console.log(`[collab] 저장 ${documentName} → version ${version}`);
  },

  async onDisconnect({ documentName, context }) {
    const { displayName } = context as ConnectionContext;
    console.log(
      `[collab] 해제 ${displayName} ← ${documentName} (version ${getVersion(documentName)})`,
    );
  },
});

server.listen().then(() => {
  console.log(`[collab] 협업 서버가 ws://127.0.0.1:${PORT} 에서 대기 중입니다.`);
});
