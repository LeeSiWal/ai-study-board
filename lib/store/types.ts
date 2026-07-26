import type { CollaborationPermission } from "../contracts/collaboration";

/**
 * 일반 업무 데이터의 타입.
 *
 * 아키텍처 §18의 모델을 프로토타입에 필요한 만큼만 옮긴 것이다.
 * 문서 **본문**은 여기 없다. 본문은 CRDT 경계에 속한다.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export type ResourceType =
  | "DOCUMENT"
  | "WHITEBOARD"
  | "FILE"
  | "FOLDER"
  | "LINK";

export interface User {
  id: string;
  email: string;
  displayName: string;
  /** 프로토타입 전용. 실제 서비스라면 해시를 저장한다. */
  password: string;
  /** 협업 커서 색 */
  cursorColor: string;
}

export interface Workspace {
  id: string;
  name: string;
  description: string;
  ownerUserId: string;
}

export interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export interface Resource {
  id: string;
  workspaceId: string;
  parentId: string | null;
  type: ResourceType;
  title: string;
  icon: string | null;
  sortOrder: number;
  createdBy: string;
}

/**
 * 문서 메타데이터. 본문은 협업 서버의 Yjs 문서에 있다.
 * 제목을 여기 두는 것은 아키텍처 §6의 결정을 따른 것이다.
 */
export interface DocumentMeta {
  resourceId: string;
  collaborationKey: string;
}

/** 역할이 기본으로 갖는 자원 권한. 자원별 권한은 이후 단계에서 덧붙인다. */
export const PERMISSIONS_BY_ROLE: Record<
  WorkspaceRole,
  CollaborationPermission[]
> = {
  OWNER: ["view", "comment", "edit", "manage"],
  ADMIN: ["view", "comment", "edit", "manage"],
  MEMBER: ["view", "comment", "edit"],
  GUEST: ["view", "comment"],
};
