import type { CollaborationPermission } from "../contracts/collaboration";
import {
  SEED_DOCUMENTS,
  SEED_MEMBERS,
  SEED_RESOURCES,
  SEED_USERS,
  SEED_WORKSPACE,
} from "./seed";
import {
  PERMISSIONS_BY_ROLE,
  type DocumentMeta,
  type Resource,
  type User,
  type Workspace,
  type WorkspaceMember,
} from "./types";

/**
 * 인메모리 스토어.
 *
 * 아키텍처가 PostgreSQL에 두기로 한 "일반 업무 데이터"의 자리다.
 * 나중에 실제 데이터베이스로 바꿀 때 이 모듈의 함수 시그니처만 유지하면
 * 호출하는 쪽은 손대지 않아도 된다.
 *
 * 개발 중 HMR이 모듈을 다시 평가해도 데이터가 초기화되지 않도록
 * globalThis에 붙여 둔다.
 */

interface StoreData {
  users: User[];
  workspace: Workspace;
  members: WorkspaceMember[];
  resources: Resource[];
  documents: DocumentMeta[];
}

const STORE_KEY = Symbol.for("ai-study-board.store");

type GlobalWithStore = typeof globalThis & {
  [STORE_KEY]?: StoreData;
};

function getStore(): StoreData {
  const scope = globalThis as GlobalWithStore;

  if (!scope[STORE_KEY]) {
    scope[STORE_KEY] = {
      users: [...SEED_USERS],
      workspace: { ...SEED_WORKSPACE },
      members: [...SEED_MEMBERS],
      resources: [...SEED_RESOURCES],
      documents: [...SEED_DOCUMENTS],
    };
  }

  return scope[STORE_KEY];
}

export function findUserByEmail(email: string): User | null {
  const normalized = email.trim().toLowerCase();
  return (
    getStore().users.find((user) => user.email.toLowerCase() === normalized) ??
    null
  );
}

export function findUserById(userId: string): User | null {
  return getStore().users.find((user) => user.id === userId) ?? null;
}

export function getWorkspace(): Workspace {
  return getStore().workspace;
}

export function findResourceById(resourceId: string): Resource | null {
  return (
    getStore().resources.find((resource) => resource.id === resourceId) ?? null
  );
}

export function listResources(workspaceId: string): Resource[] {
  return getStore()
    .resources.filter((resource) => resource.workspaceId === workspaceId)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function findDocumentMeta(resourceId: string): DocumentMeta | null {
  return (
    getStore().documents.find(
      (document) => document.resourceId === resourceId,
    ) ?? null
  );
}

export function findMembership(
  workspaceId: string,
  userId: string,
): WorkspaceMember | null {
  return (
    getStore().members.find(
      (member) =>
        member.workspaceId === workspaceId && member.userId === userId,
    ) ?? null
  );
}

/**
 * 자원에 대한 사용자 권한을 판정한다.
 *
 * 아키텍처 §17은 역할만으로 권한을 결정하지 말라고 한다. 지금은 역할 기반
 * 기본값만 구현하고, 자원별 권한과 공유 링크 정책은 이후 단계에서 이 함수
 * 안에 덧붙인다. 호출하는 쪽은 바뀌지 않는다.
 *
 * 접근 자체가 불가하면 빈 배열을 돌려준다.
 */
export function resolvePermissions(
  resourceId: string,
  userId: string,
): CollaborationPermission[] {
  const resource = findResourceById(resourceId);
  if (!resource) return [];

  const membership = findMembership(resource.workspaceId, userId);
  if (!membership) return [];

  return PERMISSIONS_BY_ROLE[membership.role];
}
