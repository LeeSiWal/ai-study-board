import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { findUserByEmail, findUserById } from "../store";
import type { User } from "../store/types";

/**
 * Auth.js 설정.
 *
 * 프로토타입이라 Credentials 프로바이더로 시드 사용자만 로그인시킨다.
 * 탭마다 다른 사용자로 로그인할 수 있어야 동시 편집을 시연할 수 있다.
 *
 * 세션에는 사용자 ID만 담고 표시 이름·커서 색은 담지 않는다. 세션에 복사해
 * 두면 사용자 정보가 바뀌었을 때 두 벌이 어긋나기 때문이다. 필요한 쪽은
 * `currentUser()`로 스토어에서 읽는다.
 */

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      // Auth.js의 authorize는 Awaitable을 받는다. 데이터베이스 조회를
      // 그대로 기다릴 수 있다.
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;

        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await findUserByEmail(email);
        if (!user || user.password !== password) return null;

        return { id: user.id, email: user.email, name: user.displayName };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});

/**
 * 현재 로그인한 사용자를 스토어에서 읽는다.
 * 로그인하지 않았거나 세션이 가리키는 사용자가 사라졌으면 null.
 */
export async function currentUser(): Promise<User | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  return findUserById(session.user.id);
}
