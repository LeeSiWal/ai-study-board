import * as Y from "yjs";

/**
 * 협업 문서의 인메모리 저장소.
 *
 * 아키텍처 §7의 저장 전략을 프로토타입 크기로 줄인 것이다. 모든 키 입력을
 * 한 행씩 기록하지 않고, 협업 서버가 디바운스한 시점의 상태만 보관한다.
 *
 * `version`은 AI 제안의 `baseVersion`이 참조할 값이다(아키텍처 §14).
 * 저장이 일어날 때마다 1씩 증가하는 단조 정수로 정의한다. Yjs의 state
 * vector를 쓰지 않는 이유는 "제안 생성 이후 문서가 바뀌었는가"라는 단일
 * 질문에만 답하면 되고, 정수 비교가 그 목적에 충분하기 때문이다.
 */

export interface StoredDocument {
  /** Y.encodeStateAsUpdate 결과 */
  state: Uint8Array;
  version: number;
  updatedAt: Date;
}

const documents = new Map<string, StoredDocument>();

export function loadDocument(documentName: string, target: Y.Doc): void {
  const stored = documents.get(documentName);
  if (!stored) return;

  Y.applyUpdate(target, stored.state);
}

/** 저장하고 증가된 version을 돌려준다. */
export function storeDocument(documentName: string, source: Y.Doc): number {
  const previous = documents.get(documentName);
  const version = (previous?.version ?? 0) + 1;

  documents.set(documentName, {
    state: Y.encodeStateAsUpdate(source),
    version,
    updatedAt: new Date(),
  });

  return version;
}

export function getVersion(documentName: string): number {
  return documents.get(documentName)?.version ?? 0;
}
