import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { and, desc, eq, gt, isNull, sql } from "drizzle-orm";

import { db, schema } from "../db";
import { randomId } from "../id";

/**
 * OAuth 2.1 — MCP 인가 명세
 *
 * 우리 서버가 인가 서버이자 리소스 서버를 겸한다. 사용자가 이미 여기
 * 로그인하므로 동의 화면에서 그 세션을 그대로 쓸 수 있다.
 *
 * 토큰은 원문을 저장하지 않는다. 데이터베이스가 새더라도 토큰 자체는
 * 복원되지 않는다.
 */

/** 인가 코드는 동의 직후 바로 교환된다. 길게 둘 이유가 없다. */
const CODE_TTL_MS = 2 * 60 * 1000;
const ACCESS_TTL_MS = 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const SCOPE = "workspace";

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function secret(): string {
  return randomBytes(32).toString("base64url");
}

/**
 * 이 MCP 서버의 정식 주소 — RFC 8707
 *
 * 토큰의 audience가 된다. 프래그먼트가 없고 끝 슬래시를 붙이지 않는다.
 */
export function canonicalResource(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp`;
}

/** 요청이 들어온 실제 주소. 터널 뒤에서는 프록시 헤더를 봐야 한다. */
export function requestOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto");

  if (forwardedHost) {
    return `${forwardedProto ?? "https"}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

// ── 클라이언트 등록 (RFC 7591) ────────────────────────────────────────────

export interface RegisteredClient {
  clientId: string;
  name: string;
  redirectUris: string[];
}

export async function registerClient(
  name: string,
  redirectUris: string[],
): Promise<RegisteredClient> {
  const [row] = await db
    .insert(schema.oauthClients)
    .values({
      id: `mcpc_${randomId()}`,
      name,
      redirectUris: JSON.stringify(redirectUris),
    })
    .returning();

  return {
    clientId: row.id,
    name: row.name,
    redirectUris: JSON.parse(row.redirectUris),
  };
}

export async function findClient(
  clientId: string,
): Promise<RegisteredClient | null> {
  const row = await db.query.oauthClients.findFirst({
    where: eq(schema.oauthClients.id, clientId),
  });

  if (!row) return null;

  return {
    clientId: row.id,
    name: row.name,
    redirectUris: JSON.parse(row.redirectUris),
  };
}

// ── 인가 코드 ─────────────────────────────────────────────────────────────

export interface IssueCodeInput {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  resource: string;
}

export async function issueAuthorizationCode(
  input: IssueCodeInput,
): Promise<string> {
  const code = secret();

  await db.insert(schema.oauthAuthorizationCodes).values({
    codeHash: sha256(code),
    clientId: input.clientId,
    userId: input.userId,
    redirectUri: input.redirectUri,
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    resource: input.resource,
    scope: SCOPE,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });

  return code;
}

export type CodeExchangeResult =
  | { ok: true; userId: string; resource: string }
  | { ok: false; error: string; description: string };

/**
 * 인가 코드를 검증하고 소비한다.
 *
 * 코드는 1회용이다. `consumed_at IS NULL` 조건을 UPDATE에 함께 걸어
 * 데이터베이스가 중복 사용을 막는다. 애플리케이션에서 확인 후 갱신하면
 * 두 요청이 겹칠 때 둘 다 통과한다.
 */
export async function consumeAuthorizationCode(
  code: string,
  clientId: string,
  redirectUri: string,
  codeVerifier: string,
): Promise<CodeExchangeResult> {
  const [row] = await db
    .update(schema.oauthAuthorizationCodes)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(schema.oauthAuthorizationCodes.codeHash, sha256(code)),
        isNull(schema.oauthAuthorizationCodes.consumedAt),
      ),
    )
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "인가 코드가 유효하지 않거나 이미 사용되었습니다.",
    };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "인가 코드가 만료되었습니다.",
    };
  }

  if (row.clientId !== clientId) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "다른 클라이언트에게 발급된 코드입니다.",
    };
  }

  // 정확히 일치해야 한다. 부분 일치를 허용하면 코드를 다른 곳으로 보낼 수 있다.
  if (row.redirectUri !== redirectUri) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "redirect_uri가 인가 요청과 다릅니다.",
    };
  }

  if (!verifyPkce(row.codeChallenge, row.codeChallengeMethod, codeVerifier)) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "code_verifier가 일치하지 않습니다.",
    };
  }

  return { ok: true, userId: row.userId, resource: row.resource };
}

/**
 * PKCE 검증 — OAuth 2.1이 MUST로 요구한다.
 *
 * 인가 코드가 새어도 원래 요청자만 교환할 수 있게 한다. `plain`은 받지
 * 않는다. 명세가 S256을 요구하고, plain을 열어 두면 방어가 무의미해진다.
 */
function verifyPkce(
  challenge: string,
  method: string,
  verifier: string,
): boolean {
  if (method !== "S256") return false;

  const computed = createHash("sha256").update(verifier).digest("base64url");

  const a = Buffer.from(computed);
  const b = Buffer.from(challenge);

  // 길이가 다르면 timingSafeEqual이 던진다. 먼저 확인한다.
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}

// ── 토큰 ──────────────────────────────────────────────────────────────────

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function issueTokens(
  clientId: string,
  userId: string,
  resource: string,
): Promise<IssuedTokens> {
  const accessToken = secret();
  const refreshToken = secret();
  const now = Date.now();

  await db.insert(schema.oauthTokens).values([
    {
      id: randomId(),
      tokenHash: sha256(accessToken),
      type: "access",
      clientId,
      userId,
      resource,
      scope: SCOPE,
      expiresAt: new Date(now + ACCESS_TTL_MS),
    },
    {
      id: randomId(),
      tokenHash: sha256(refreshToken),
      type: "refresh",
      clientId,
      userId,
      resource,
      scope: SCOPE,
      expiresAt: new Date(now + REFRESH_TTL_MS),
    },
  ]);

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TTL_MS / 1000),
  };
}

export interface AccessTokenClaims {
  userId: string;
  clientId: string;
  resource: string;
}

/**
 * 액세스 토큰을 검증한다.
 *
 * `resource`를 함께 받아 audience를 확인한다. 명세가 MUST로 요구하는
 * 검사다. 이걸 빼면 다른 서비스용으로 발급된 토큰이 통과한다.
 */
export async function verifyAccessToken(
  token: string,
  expectedResource: string,
): Promise<AccessTokenClaims | null> {
  const row = await db.query.oauthTokens.findFirst({
    where: and(
      eq(schema.oauthTokens.tokenHash, sha256(token)),
      eq(schema.oauthTokens.type, "access"),
      isNull(schema.oauthTokens.revokedAt),
    ),
  });

  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.resource !== expectedResource) return null;

  return {
    userId: row.userId,
    clientId: row.clientId,
    resource: row.resource,
  };
}

// ── 연결 관리 ─────────────────────────────────────────────────────────────

export interface Connection {
  clientId: string;
  name: string;
  authorizedAt: Date;
}

/**
 * 이 사용자가 승인한 앱 목록.
 *
 * 살아 있는 토큰이 하나라도 있으면 연결된 것으로 본다. 승인할 때마다 토큰
 * 쌍이 새로 생기므로 클라이언트별로 묶고 가장 오래된 발급 시각을 "언제부터
 * 연결됐는지"로 보여준다.
 */
export async function listConnections(userId: string): Promise<Connection[]> {
  const rows = await db
    .select({
      clientId: schema.oauthClients.id,
      name: schema.oauthClients.name,
      authorizedAt: sql<Date>`min(${schema.oauthTokens.createdAt})`.as(
        "authorized_at",
      ),
    })
    .from(schema.oauthTokens)
    .innerJoin(
      schema.oauthClients,
      eq(schema.oauthTokens.clientId, schema.oauthClients.id),
    )
    .where(
      and(
        eq(schema.oauthTokens.userId, userId),
        isNull(schema.oauthTokens.revokedAt),
        gt(schema.oauthTokens.expiresAt, new Date()),
      ),
    )
    .groupBy(schema.oauthClients.id, schema.oauthClients.name)
    .orderBy(desc(sql`min(${schema.oauthTokens.createdAt})`));

  return rows.map((row) => ({
    ...row,
    authorizedAt: new Date(row.authorizedAt),
  }));
}

/**
 * 연결을 끊는다. 액세스와 리프레시를 함께 폐기해야 한다 — 액세스만 지우면
 * 클라이언트가 리프레시로 곧바로 되살린다.
 */
export async function revokeConnection(
  userId: string,
  clientId: string,
): Promise<boolean> {
  const revoked = await db
    .update(schema.oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.oauthTokens.userId, userId),
        eq(schema.oauthTokens.clientId, clientId),
        isNull(schema.oauthTokens.revokedAt),
      ),
    )
    .returning({ id: schema.oauthTokens.id });

  return revoked.length > 0;
}

export type RefreshResult =
  | { ok: true; tokens: IssuedTokens }
  | { ok: false; error: string; description: string };

/**
 * 리프레시 토큰을 교환한다.
 *
 * 공개 클라이언트에는 회전이 MUST다. 쓴 토큰을 즉시 폐기하고 새로 발급한다.
 * 폐기를 조건부 UPDATE로 해서 같은 토큰이 두 번 쓰이지 않게 한다.
 */
export async function refreshTokens(
  refreshToken: string,
  clientId: string,
): Promise<RefreshResult> {
  const [row] = await db
    .update(schema.oauthTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(schema.oauthTokens.tokenHash, sha256(refreshToken)),
        eq(schema.oauthTokens.type, "refresh"),
        isNull(schema.oauthTokens.revokedAt),
      ),
    )
    .returning();

  if (!row) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "리프레시 토큰이 유효하지 않거나 이미 사용되었습니다.",
    };
  }

  if (row.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "리프레시 토큰이 만료되었습니다.",
    };
  }

  if (row.clientId !== clientId) {
    return {
      ok: false,
      error: "invalid_grant",
      description: "다른 클라이언트에게 발급된 토큰입니다.",
    };
  }

  return {
    ok: true,
    tokens: await issueTokens(row.clientId, row.userId, row.resource),
  };
}
