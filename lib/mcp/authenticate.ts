import { findClient, verifyAccessToken } from "../oauth/core";
import { findUserById, getWorkspace } from "../store";
import type { User } from "../store/types";
import { authenticateToken } from "./tokens";

/**
 * MCP 요청의 인증 — 두 갈래
 *
 * 1. OAuth 액세스 토큰. Claude Desktop 같은 클라이언트가 서버 주소만 받고
 *    스스로 등록·인가·발급을 마친 뒤 들고 오는 토큰이다. 사용자가 손으로
 *    할 일은 "연결 승인" 한 번뿐이다.
 * 2. 설정 화면에서 발급한 `mcp_` 정적 토큰. OAuth를 못 타는 클라이언트와
 *    스크립트를 위해 남겨 둔다.
 *
 * 어느 쪽이든 결과는 같다 — 누구의 권한으로, 어느 워크스페이스에서 도는지.
 * 권한은 항상 그 사용자의 워크스페이스 권한을 넘지 못한다.
 */

export interface McpIdentity {
  user: User;
  workspaceId: string;
  /** 감사 로그와 제안 목록에 남길 클라이언트 이름. */
  clientLabel: string;
}

export async function authenticateMcpRequest(
  token: string,
  resource: string,
): Promise<McpIdentity | null> {
  // 정적 토큰은 접두사로 구분된다. OAuth 토큰 조회를 건너뛸 수 있다.
  if (token.startsWith("mcp_")) {
    const authenticated = await authenticateToken(token);
    if (!authenticated) return null;

    return {
      user: authenticated.user,
      workspaceId: authenticated.record.workspaceId,
      clientLabel: authenticated.record.name,
    };
  }

  // audience를 함께 넘긴다. 다른 서버용으로 발급된 토큰이 여기서 통과하면
  // 안 된다 — 혼동된 대리인(confused deputy) 문제의 핵심이다.
  const claims = await verifyAccessToken(token, resource);
  if (!claims) return null;

  const user = await findUserById(claims.userId);
  if (!user) return null;

  const client = await findClient(claims.clientId);
  const workspace = await getWorkspace();

  return {
    user,
    workspaceId: workspace.id,
    clientLabel: client?.name ?? "MCP 클라이언트",
  };
}
