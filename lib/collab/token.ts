import { SignJWT, jwtVerify } from "jose";

import {
  COLLABORATION_TOKEN_TTL_SECONDS,
  collaborationTokenClaimsSchema,
  type CollaborationTokenClaims,
} from "../contracts/collaboration";

/**
 * 협업 토큰 서명과 검증.
 *
 * Next.js 앱이 서명하고 협업 서버가 검증한다. 두 프로세스가 같은 비밀키를
 * 공유하므로 COLLAB_TOKEN_SECRET은 양쪽 환경에 모두 있어야 한다.
 */

const ALGORITHM = "HS256";

function secretKey(): Uint8Array {
  const value = process.env.COLLAB_TOKEN_SECRET;
  if (!value) {
    throw new Error(
      "COLLAB_TOKEN_SECRET 환경변수가 없습니다. .env.local을 확인하세요.",
    );
  }
  return new TextEncoder().encode(value);
}

export async function signCollaborationToken(
  claims: CollaborationTokenClaims,
): Promise<string> {
  const validated = collaborationTokenClaimsSchema.parse(claims);

  return new SignJWT({ ...validated })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(`${COLLABORATION_TOKEN_TTL_SECONDS}s`)
    .sign(secretKey());
}

/**
 * 토큰을 검증하고 claim을 돌려준다.
 * 서명이 틀렸거나, 만료되었거나, 형식이 어긋나면 throw 한다.
 */
export async function verifyCollaborationToken(
  token: string,
): Promise<CollaborationTokenClaims> {
  const { payload } = await jwtVerify(token, secretKey(), {
    algorithms: [ALGORITHM],
  });

  return collaborationTokenClaimsSchema.parse(payload);
}
