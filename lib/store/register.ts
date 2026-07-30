import { eq, sql } from "drizzle-orm";

import { hashPassword } from "../auth/password";
import { CURSOR_COLORS, type RegisterInput } from "../contracts/auth";
import { db, schema } from "../db";
import { randomId } from "../id";
import { getWorkspace } from ".";
import type { User } from "./types";

/**
 * 회원가입 — 아키텍처 §21의 `POST /auth/register`
 *
 * 가입한 사용자를 시드 워크스페이스에 MEMBER로 넣는다. 지금 단계에서 확인하려는
 * 것이 협업이라, 가입 직후 다른 사람이 있는 문서에 들어가야 동시 편집·AI
 * 제안·댓글을 바로 시험할 수 있다. 빈 워크스페이스를 새로 파면 혼자라
 * 아무것도 확인되지 않는다.
 *
 * MEMBER는 view·comment·edit을 갖고 manage는 갖지 않는다(§17). 워크스페이스
 * 설정이나 멤버 관리는 못 하지만 문서 작업은 전부 할 수 있다.
 */

export type RegisterResult =
  | { ok: true; user: User }
  | { ok: false; reason: "email_taken" };

export async function registerUser(
  input: RegisterInput,
): Promise<RegisterResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existing) return { ok: false, reason: "email_taken" };

  const workspace = await getWorkspace();

  const user = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(schema.users)
      .values({
        id: randomId(),
        email,
        displayName: input.displayName.trim(),
        password: await hashPassword(input.password),
        cursorColor: await nextCursorColor(tx),
      })
      .returning();

    await tx.insert(schema.workspaceMembers).values({
      workspaceId: workspace.id,
      userId: created.id,
      role: "MEMBER",
    });

    return created;
  });

  return { ok: true, user };
}

/**
 * 아직 안 쓰인 색을 고른다. 다 쓰였으면 인원수로 돌려 쓴다.
 *
 * 트랜잭션 안에서 세므로 같은 순간에 둘이 가입해도 같은 색을 받지 않는다.
 */
async function nextCursorColor(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
): Promise<string> {
  const rows = await tx
    .select({ cursorColor: schema.users.cursorColor })
    .from(schema.users);

  const used = new Set(rows.map((row) => row.cursorColor));
  const free = CURSOR_COLORS.find((color) => !used.has(color));

  return free ?? CURSOR_COLORS[rows.length % CURSOR_COLORS.length];
}

/** 가입 화면에서 이메일 중복을 미리 알려줄 때 쓴다. */
export async function isEmailTaken(email: string): Promise<boolean> {
  const row = await db.query.users.findFirst({
    where: eq(schema.users.email, email.trim().toLowerCase()),
    columns: { id: true },
  });

  return !!row;
}

/** 워크스페이스 인원. 가입 화면에서 "N명이 함께합니다"에 쓴다. */
export async function memberCount(): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.workspaceMembers);

  return row?.count ?? 0;
}
