import { relations } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * 데이터베이스 스키마 — 아키텍처 §18
 *
 * 여기 담기는 것은 "일반 업무 데이터"뿐이다(§3.1). 문서 본문은 CRDT에 있고,
 * 그 스냅샷만 `collaborationDocuments`에 바이너리로 들어온다. 본문을 여기서
 * 텍스트로 다루기 시작하면 출처가 둘이 되고 §3.2가 금지한 상태가 된다.
 */

/** Yjs 상태는 바이너리다. Drizzle에 bytea 타입이 없어 직접 정의한다. */
const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => "bytea",
  toDriver: (value) => Buffer.from(value),
  fromDriver: (value) => new Uint8Array(value),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  /** 프로토타입 전용. 실제 서비스라면 해시를 저장한다. */
  password: text("password").notNull(),
  cursorColor: text("cursor_color").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaces = pgTable("workspaces", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  ownerUserId: text("owner_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const workspaceMembers = pgTable(
  "workspace_members",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** OWNER | ADMIN | MEMBER | GUEST */
    role: text("role").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })],
);

/**
 * 문서·화이트보드·파일을 한 트리에 담는다(§9).
 *
 * `parentId`가 자기 자신을 참조한다. 타입별 상세는 별도 테이블로 나눈다는
 * 것이 §9의 설계지만, 지금은 문서만 상세가 있어 `documents` 하나만 둔다.
 */
export const resources = pgTable(
  "resources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    /** DOCUMENT | WHITEBOARD | FILE | FOLDER | LINK */
    type: text("type").notNull(),
    title: text("title").notNull(),
    icon: text("icon"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    index("resources_workspace_idx").on(table.workspaceId, table.sortOrder),
    index("resources_parent_idx").on(table.parentId),
  ],
);

export const documents = pgTable("documents", {
  resourceId: text("resource_id")
    .primaryKey()
    .references(() => resources.id, { onDelete: "cascade" }),
  /** 협업 Room 이름. doc:{resourceId} 형태(§7). */
  collaborationKey: text("collaboration_key").notNull(),
});

/**
 * 화이트보드 장면.
 *
 * Excalidraw의 elements/files와 공유 가능한 appState만 JSON으로 직렬화한다.
 * 뷰포트·현재 도구·선택처럼 개인적인 UI 상태는 클라이언트에만 남긴다.
 */
export const whiteboards = pgTable("whiteboards", {
  resourceId: text("resource_id")
    .primaryKey()
    .references(() => resources.id, { onDelete: "cascade" }),
  scene: text("scene").notNull(),
  version: bigint("version", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 협업 문서의 스냅샷 — §7
 *
 * 본문의 출처는 여전히 CRDT다. 이 테이블은 협업 서버가 재시작해도 문서가
 * 남도록 마지막 상태를 보관할 뿐이다.
 *
 * `version`은 AI 제안의 `baseVersion`이 참조하는 단조 정수다(§14).
 */
export const collaborationDocuments = pgTable("collaboration_documents", {
  documentKey: text("document_key").primaryKey(),
  state: bytea("state").notNull(),
  version: bigint("version", { mode: "number" }).notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    parentCommentId: text("parent_comment_id"),
    /** 연결된 블록. AI 제안과 같은 앵커를 쓴다(§14). */
    blockId: text("block_id"),
    /** 연결 당시의 문장. 원문이 바뀌어도 무엇에 단 댓글인지 남는다. */
    anchorText: text("anchor_text"),
    authorUserId: text("author_user_id")
      .notNull()
      .references(() => users.id),
    content: text("content").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("comments_resource_idx").on(table.resourceId, table.createdAt)],
);

/**
 * AI 제안 — §18
 *
 * `operations`는 JSON 문자열로 둔다. 스키마는 `lib/contracts/ai.ts`의 Zod가
 * 소유하고, 읽을 때 그것으로 검증한다. 데이터베이스에 형태를 두 벌 두면
 * 어긋날 때 어느 쪽이 맞는지 알 수 없게 된다.
 */
export const aiProposals = pgTable(
  "ai_proposals",
  {
    id: text("id").primaryKey(),
    resourceId: text("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    baseVersion: bigint("base_version", { mode: "number" }).notNull(),
    modelLabel: text("model_label").notNull(),
    summary: text("summary").notNull(),
    operations: text("operations").notNull(),
    /** workspace_ai | mcp_client */
    origin: text("origin").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id),
    createdByLabel: text("created_by_label").notNull(),
    /** pending | applied | rejected */
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: text("resolved_by").references(() => users.id),
  },
  (table) => [
    index("ai_proposals_pending_idx").on(table.resourceId, table.status),
  ],
);

/**
 * MCP 접속 토큰 — §15.4
 *
 * 원문은 저장하지 않는다. 해시만 두고 목록에는 앞뒤 몇 글자만 보여준다.
 */
export const mcpAccessTokens = pgTable(
  "mcp_access_tokens",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull(),
    hint: text("hint").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (table) => [uniqueIndex("mcp_tokens_hash_idx").on(table.tokenHash)],
);

export const workspacesRelations = relations(workspaces, ({ many }) => ({
  members: many(workspaceMembers),
  resources: many(resources),
}));

export const resourcesRelations = relations(resources, ({ one, many }) => ({
  workspace: one(workspaces, {
    fields: [resources.workspaceId],
    references: [workspaces.id],
  }),
  document: one(documents, {
    fields: [resources.id],
    references: [documents.resourceId],
  }),
  whiteboard: one(whiteboards, {
    fields: [resources.id],
    references: [whiteboards.resourceId],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  author: one(users, {
    fields: [comments.authorUserId],
    references: [users.id],
  }),
}));

/**
 * OAuth 2.1 — MCP 인가 명세
 *
 * Claude Desktop 같은 클라이언트는 미리 등록할 방법이 없어 동적 등록으로
 * 스스로 들어온다(RFC 7591). 그래서 이 표는 사용자가 만드는 것이 아니라
 * 클라이언트가 채운다.
 */
export const oauthClients = pgTable("oauth_clients", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** JSON 배열. 인가 시 정확히 일치해야 한다. 부분 일치를 허용하면
   *  공격자가 인가 코드를 자기 서버로 빼돌릴 수 있다. */
  redirectUris: text("redirect_uris").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * 인가 코드.
 *
 * 원문을 저장하지 않고 해시만 둔다. 1회용이며 짧게 만료된다. PKCE
 * challenge를 함께 보관했다가 토큰 교환 때 verifier와 대조한다 — 코드가
 * 새어도 원래 요청자만 쓸 수 있게 하는 장치다.
 */
export const oauthAuthorizationCodes = pgTable("oauth_authorization_codes", {
  codeHash: text("code_hash").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => oauthClients.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  redirectUri: text("redirect_uri").notNull(),
  codeChallenge: text("code_challenge").notNull(),
  codeChallengeMethod: text("code_challenge_method").notNull(),
  /** RFC 8707 resource. 토큰의 audience가 된다. */
  resource: text("resource").notNull(),
  scope: text("scope").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
});

/**
 * 액세스·리프레시 토큰.
 *
 * `resource`가 audience다. 명세는 우리를 위해 발급된 토큰인지 검증하라고
 * MUST로 요구한다. 이걸 빼면 다른 서비스용 토큰을 들고 와도 통과한다.
 */
export const oauthTokens = pgTable(
  "oauth_tokens",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    /** access | refresh */
    type: text("type").notNull(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClients.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    scope: text("scope").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("oauth_tokens_hash_idx").on(table.tokenHash),
    index("oauth_tokens_user_idx").on(table.userId, table.type),
  ],
);
