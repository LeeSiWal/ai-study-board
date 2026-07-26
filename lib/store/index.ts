import { and, asc, eq } from "drizzle-orm";

import type { CollaborationPermission } from "../contracts/collaboration";
import { db, schema } from "../db";
import {
  PERMISSIONS_BY_ROLE,
  type DocumentMeta,
  type Resource,
  type User,
  type Workspace,
  type WorkspaceMember,
  type WorkspaceRole,
} from "./types";

/**
 * 일반 업무 데이터 — 아키텍처 §3.1
 *
 * PostgreSQL이 소유한다. 문서 본문은 여기 없다. 본문은 CRDT에 있고 그
 * 스냅샷만 협업 서버가 `collaboration_documents`에 넣는다.
 *
 * 이 모듈의 함수 시그니처는 인메모리 시절과 같다. 반환 타입만 Promise로
 * 바뀌었다. 호출하는 쪽은 await만 붙이면 된다.
 */

export function findUserByEmail(email: string): Promise<User | null> {
  return db.query.users
    .findFirst({ where: eq(schema.users.email, email.trim().toLowerCase()) })
    .then((row) => row ?? null);
}

export function findUserById(userId: string): Promise<User | null> {
  return db.query.users
    .findFirst({ where: eq(schema.users.id, userId) })
    .then((row) => row ?? null);
}

export async function getWorkspace(): Promise<Workspace> {
  const workspace = await db.query.workspaces.findFirst();

  if (!workspace) {
    throw new Error(
      "워크스페이스가 없습니다. npm run db:seed를 먼저 실행하세요.",
    );
  }

  return workspace;
}

export function findResourceById(resourceId: string): Promise<Resource | null> {
  return db.query.resources
    .findFirst({ where: eq(schema.resources.id, resourceId) })
    .then((row) => (row as Resource | undefined) ?? null);
}

export function listResources(workspaceId: string): Promise<Resource[]> {
  return db.query.resources
    .findMany({
      where: eq(schema.resources.workspaceId, workspaceId),
      orderBy: [asc(schema.resources.sortOrder)],
    })
    .then((rows) => rows as Resource[]);
}

export function findDocumentMeta(
  resourceId: string,
): Promise<DocumentMeta | null> {
  return db.query.documents
    .findFirst({ where: eq(schema.documents.resourceId, resourceId) })
    .then((row) => row ?? null);
}

export async function updateResourceTitle(
  resourceId: string,
  title: string,
): Promise<Resource | null> {
  const [updated] = await db
    .update(schema.resources)
    .set({ title, updatedAt: new Date() })
    .where(eq(schema.resources.id, resourceId))
    .returning();

  return (updated as Resource | undefined) ?? null;
}

export function findMembership(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMember | null> {
  return db.query.workspaceMembers
    .findFirst({
      where: and(
        eq(schema.workspaceMembers.workspaceId, workspaceId),
        eq(schema.workspaceMembers.userId, userId),
      ),
    })
    .then((row) => (row ? { ...row, role: row.role as WorkspaceRole } : null));
}

export async function listMembersWithUsers(workspaceId: string) {
  const rows = await db
    .select()
    .from(schema.workspaceMembers)
    .innerJoin(
      schema.users,
      eq(schema.workspaceMembers.userId, schema.users.id),
    )
    .where(eq(schema.workspaceMembers.workspaceId, workspaceId));

  return rows.map((row) => ({
    ...row.workspace_members,
    role: row.workspace_members.role as WorkspaceRole,
    user: row.users,
  }));
}

/**
 * 자원에 대한 사용자 권한을 판정한다 — §17
 *
 * 역할만으로 모든 권한을 결정하지 않는다는 것이 설계다. 지금은 역할 기반
 * 기본값만 구현하고, 자원별 권한과 공유 링크 정책은 이 함수 안에 덧붙인다.
 * 호출하는 쪽은 바뀌지 않는다.
 *
 * 접근 자체가 불가하면 빈 배열을 돌려준다.
 */
export async function resolvePermissions(
  resourceId: string,
  userId: string,
): Promise<CollaborationPermission[]> {
  const resource = await findResourceById(resourceId);
  if (!resource) return [];

  const membership = await findMembership(resource.workspaceId, userId);
  if (!membership) return [];

  return PERMISSIONS_BY_ROLE[membership.role];
}
