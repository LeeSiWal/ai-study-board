import { z } from "zod";

/**
 * 협업 토큰 계약.
 *
 * 아키텍처 §17에 따라 WebSocket 연결에는 로그인 자격 증명을 그대로 쓰지 않고,
 * API가 권한을 확인해 발급한 짧은 만료의 서명 토큰을 사용한다.
 *
 * 이 모듈은 Next.js 앱과 협업 서버가 **함께** 참조한다.
 * 발급하는 쪽과 검증하는 쪽이 같은 스키마를 보는 것이 이 경계의 핵심이다.
 */

/** 협업 토큰 수명. 짧게 유지하고 필요할 때마다 재발급한다. */
export const COLLABORATION_TOKEN_TTL_SECONDS = 60;

export const collaborationPermissionSchema = z.enum([
  "view",
  "comment",
  "edit",
  "manage",
]);

export type CollaborationPermission = z.infer<
  typeof collaborationPermissionSchema
>;

export const collaborationTokenClaimsSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  /** 협업 커서 색. 사용자 식별은 색이 아니라 이름으로 한다(UI 명세 §26). */
  cursorColor: z.string().min(1),
  workspaceId: z.string().min(1),
  resourceId: z.string().min(1),
  permissions: z.array(collaborationPermissionSchema).min(1),
});

export type CollaborationTokenClaims = z.infer<
  typeof collaborationTokenClaimsSchema
>;

/**
 * 협업 Room 이름. 문서와 화이트보드는 서로 다른 Room을 쓴다(아키텍처 §7).
 */
export function documentNameForResource(resourceId: string): string {
  return `doc:${resourceId}`;
}

/** Room 이름에서 리소스 ID를 되돌린다. 형식이 어긋나면 null. */
export function resourceIdFromDocumentName(
  documentName: string,
): string | null {
  const separator = documentName.indexOf(":");
  if (separator === -1) return null;

  const prefix = documentName.slice(0, separator);
  const resourceId = documentName.slice(separator + 1);

  if (prefix !== "doc" || resourceId.length === 0) return null;
  return resourceId;
}
