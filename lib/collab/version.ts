import { documentNameForResource } from "../contracts/collaboration";

/**
 * 협업 서버에서 문서의 현재 `content_version`을 읽는다.
 *
 * 이 값이 AI 제안의 `baseVersion`이 되고, 승인 시점에 문서가 그 뒤로
 * 바뀌었는지 판단하는 기준이 된다(아키텍처 §14).
 *
 * 본문 길이나 해시가 아니라 단조 정수를 쓰는 이유는, 문서 가운데를 고쳐
 * 길이가 그대로인 경우를 놓치지 않기 위해서다.
 */

/** 버전 조회는 협업 서버의 별도 포트에서 받는다. 서버 간 호출 전용이다. */
function versionServiceUrl(): string {
  const port = process.env.COLLAB_VERSION_PORT ?? "7173";
  return `http://127.0.0.1:${port}`;
}

export async function readContentVersion(resourceId: string): Promise<number> {
  const documentName = documentNameForResource(resourceId);
  const secret = process.env.COLLAB_TOKEN_SECRET;

  if (!secret) {
    throw new Error("COLLAB_TOKEN_SECRET 환경변수가 없습니다.");
  }

  const url = `${versionServiceUrl()}/documents/${encodeURIComponent(documentName)}/version`;

  const response = await fetch(url, {
    headers: { "x-collab-secret": secret },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`협업 서버에서 버전을 읽지 못했습니다 (${response.status})`);
  }

  const body: { version: number } = await response.json();
  return body.version;
}
