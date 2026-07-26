import type { CollaborationPermission } from "../contracts/collaboration";
import type { schema } from "../db";

/**
 * 일반 업무 데이터의 타입 — 아키텍처 §18
 *
 * 테이블 정의에서 끌어온다. 손으로 인터페이스를 또 쓰면 스키마와 어긋날 때
 * 어느 쪽이 맞는지 알 수 없게 된다.
 *
 * 문서 **본문**은 여기 없다. 본문은 CRDT 경계에 속한다.
 */

export type WorkspaceRole = "OWNER" | "ADMIN" | "MEMBER" | "GUEST";

export type ResourceType =
  | "DOCUMENT"
  | "WHITEBOARD"
  | "FILE"
  | "FOLDER"
  | "LINK";

export type User = typeof schema.users.$inferSelect;
export type Workspace = typeof schema.workspaces.$inferSelect;
export type DocumentMeta = typeof schema.documents.$inferSelect;

/** 문자열 컬럼을 좁혀 쓴다. 데이터베이스는 text지만 코드에서는 좁은 편이 낫다. */
export type Resource = Omit<typeof schema.resources.$inferSelect, "type"> & {
  type: ResourceType;
};

export type WorkspaceMember = Omit<
  typeof schema.workspaceMembers.$inferSelect,
  "role"
> & {
  role: WorkspaceRole;
};

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
