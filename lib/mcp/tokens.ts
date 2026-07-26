import { createHash, randomBytes } from "node:crypto";

import { and, eq, isNull } from "drizzle-orm";

import { db, schema } from "../db";
import { randomId } from "../id";
import { findUserById, getWorkspace } from "../store";
import type { User } from "../store/types";

/**
 * MCP 접속 토큰 — 아키텍처 §15.4
 *
 * MCP 클라이언트는 브라우저 세션 쿠키를 쓸 수 없다. 사용자가 설정 화면에서
 * 토큰을 발급받아 클라이언트 설정에 넣는다.
 *
 * 원문은 발급 시 한 번만 보여주고 해시만 저장한다. 데이터베이스가 새더라도
 * 토큰 자체는 복원되지 않는다.
 */

export type McpAccessToken = typeof schema.mcpAccessTokens.$inferSelect;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedToken {
  record: McpAccessToken;
  /** 이 값은 다시 볼 수 없다. */
  token: string;
}

export async function issueToken(
  ownerUserId: string,
  name: string,
): Promise<IssuedToken> {
  const token = `mcp_${randomBytes(24).toString("base64url")}`;
  const workspace = await getWorkspace();

  const [record] = await db
    .insert(schema.mcpAccessTokens)
    .values({
      id: randomId(),
      ownerUserId,
      workspaceId: workspace.id,
      name,
      tokenHash: hash(token),
      hint: `${token.slice(0, 8)}…${token.slice(-4)}`,
    })
    .returning();

  return { record, token };
}

export function listTokens(ownerUserId: string): Promise<McpAccessToken[]> {
  return db.query.mcpAccessTokens.findMany({
    where: and(
      eq(schema.mcpAccessTokens.ownerUserId, ownerUserId),
      isNull(schema.mcpAccessTokens.revokedAt),
    ),
  });
}

export async function revokeToken(
  ownerUserId: string,
  id: string,
): Promise<boolean> {
  const [row] = await db
    .update(schema.mcpAccessTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.mcpAccessTokens.id, id),
        eq(schema.mcpAccessTokens.ownerUserId, ownerUserId),
        isNull(schema.mcpAccessTokens.revokedAt),
      ),
    )
    .returning();

  return !!row;
}

/**
 * 토큰으로 소유자를 찾는다. 권한은 소유자의 워크스페이스 권한을 넘지 못한다.
 * 유효하지 않으면 null.
 */
export async function authenticateToken(
  token: string,
): Promise<{ user: User; record: McpAccessToken } | null> {
  const record = await db.query.mcpAccessTokens.findFirst({
    where: and(
      eq(schema.mcpAccessTokens.tokenHash, hash(token)),
      isNull(schema.mcpAccessTokens.revokedAt),
    ),
  });

  if (!record) return null;

  const user = await findUserById(record.ownerUserId);
  if (!user) return null;

  // 마지막 사용 시각은 목록에서 어느 토큰이 살아 있는지 보는 데 쓴다.
  await db
    .update(schema.mcpAccessTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(schema.mcpAccessTokens.id, record.id));

  return { user, record };
}

/** `Authorization: Bearer …` 헤더에서 토큰을 꺼낸다. */
export function bearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;

  const token = header.slice(7).trim();
  return token.length ? token : null;
}
