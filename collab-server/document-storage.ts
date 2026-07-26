import { eq, sql } from "drizzle-orm";
import * as Y from "yjs";

import { db, schema } from "../lib/db";

/**
 * 협업 문서의 저장소 — 아키텍처 §7
 *
 * 모든 키 입력을 한 행씩 기록하지 않는다. 협업 서버가 디바운스한 시점의
 * 상태만 보관한다. 본문의 출처는 여전히 CRDT이고, 이 표는 서버가 재시작해도
 * 문서가 남도록 마지막 상태를 담을 뿐이다.
 *
 * `version`은 AI 제안의 `baseVersion`이 참조할 값이다(§14). 저장이 일어날
 * 때마다 1씩 증가하는 단조 정수로 정의한다. Yjs의 state vector를 쓰지 않는
 * 이유는 "제안 생성 이후 문서가 바뀌었는가"라는 단일 질문에만 답하면 되고,
 * 정수 비교가 그 목적에 충분하기 때문이다.
 */

export async function loadDocument(
  documentName: string,
  target: Y.Doc,
): Promise<void> {
  const row = await db.query.collaborationDocuments.findFirst({
    where: eq(schema.collaborationDocuments.documentKey, documentName),
  });

  if (!row) return;

  Y.applyUpdate(target, row.state);
}

/**
 * 저장하고 증가된 version을 돌려준다.
 *
 * version 증가를 데이터베이스에서 한다. 애플리케이션에서 읽고 더해서 쓰면
 * 두 저장이 겹칠 때 같은 번호가 두 번 나온다.
 */
export async function storeDocument(
  documentName: string,
  source: Y.Doc,
): Promise<number> {
  const state = Y.encodeStateAsUpdate(source);

  const [row] = await db
    .insert(schema.collaborationDocuments)
    .values({ documentKey: documentName, state, version: 1 })
    .onConflictDoUpdate({
      target: schema.collaborationDocuments.documentKey,
      set: {
        state,
        version: sql`${schema.collaborationDocuments.version} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row.version;
}

export async function getVersion(documentName: string): Promise<number> {
  const row = await db.query.collaborationDocuments.findFirst({
    where: eq(schema.collaborationDocuments.documentKey, documentName),
  });

  return row?.version ?? 0;
}
