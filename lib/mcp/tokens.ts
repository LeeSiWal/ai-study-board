import { createHash, randomBytes } from "node:crypto";

import { findUserById, getWorkspace } from "../store";
import type { User } from "../store/types";

/**
 * MCP 접속 토큰 — 아키텍처 §15.4
 *
 * MCP 클라이언트는 브라우저 세션 쿠키를 쓸 수 없다. 사용자가 설정 화면에서
 * 토큰을 발급받아 클라이언트 설정에 넣는다.
 *
 * 원문은 발급 시 한 번만 보여주고 해시만 저장한다. 저장소가 새더라도 토큰
 * 자체는 복원되지 않는다.
 */

export interface McpAccessToken {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  name: string;
  tokenHash: string;
  /** 원문 앞부분. 목록에서 어느 토큰인지 알아보게 한다. */
  hint: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

const TOKENS_KEY = Symbol.for("ai-study-board.mcp-tokens");

type GlobalWithTokens = typeof globalThis & {
  [TOKENS_KEY]?: McpAccessToken[];
};

function store(): McpAccessToken[] {
  const scope = globalThis as GlobalWithTokens;
  scope[TOKENS_KEY] ??= [];
  return scope[TOKENS_KEY];
}

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedToken {
  record: McpAccessToken;
  /** 이 값은 다시 볼 수 없다. */
  token: string;
}

export function issueToken(ownerUserId: string, name: string): IssuedToken {
  const token = `mcp_${randomBytes(24).toString("base64url")}`;

  const record: McpAccessToken = {
    id: crypto.randomUUID(),
    ownerUserId,
    workspaceId: getWorkspace().id,
    name,
    tokenHash: hash(token),
    hint: `${token.slice(0, 8)}…${token.slice(-4)}`,
    createdAt: new Date(),
    lastUsedAt: null,
    revokedAt: null,
  };

  store().push(record);
  return { record, token };
}

export function listTokens(ownerUserId: string): McpAccessToken[] {
  return store().filter(
    (record) => record.ownerUserId === ownerUserId && !record.revokedAt,
  );
}

export function revokeToken(ownerUserId: string, id: string): boolean {
  const record = store().find(
    (candidate) => candidate.id === id && candidate.ownerUserId === ownerUserId,
  );

  if (!record) return false;

  record.revokedAt = new Date();
  return true;
}

/**
 * 토큰으로 소유자를 찾는다. 권한은 소유자의 워크스페이스 권한을 넘지 못한다.
 * 유효하지 않으면 null.
 */
export function authenticateToken(
  token: string,
): { user: User; record: McpAccessToken } | null {
  const digest = hash(token);
  const record = store().find((candidate) => candidate.tokenHash === digest);

  if (!record || record.revokedAt) return null;

  const user = findUserById(record.ownerUserId);
  if (!user) return null;

  record.lastUsedAt = new Date();
  return { user, record };
}

/** `Authorization: Bearer …` 헤더에서 토큰을 꺼낸다. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const token = header.slice(7).trim();
  return token.length ? token : null;
}
