import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import { auth, signIn } from "@/lib/auth";
import { SEED_PASSWORD, SEED_USERS, SEED_WORKSPACE } from "@/lib/store/seed";
import { DEMO_DOCUMENT_ID } from "@/lib/store/seed";

/**
 * AUTH-01 로그인 (Phase 0 최소 형태)
 *
 * 스타일은 Phase 1에서 UI 명세 §8에 맞춰 다시 만든다. 지금 필요한 것은
 * 탭마다 다른 사용자로 로그인해 동시 편집을 시연할 수 있는가뿐이다.
 */

const DEMO_PATH = `/w/${SEED_WORKSPACE.id}/doc/${DEMO_DOCUMENT_ID}`;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect(DEMO_PATH);

  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";

    try {
      await signIn("credentials", {
        email: formData.get("email"),
        password: formData.get("password"),
        redirectTo: DEMO_PATH,
      });
    } catch (caught) {
      if (caught instanceof AuthError) {
        redirect("/login?error=invalid");
      }
      throw caught;
    }
  }

  return (
    <main style={{ maxWidth: 480, margin: "80px auto", padding: 24 }}>
      <h1>AI 스터디</h1>
      <p>함께 공부하고, AI와 정리하세요.</p>

      {error === "invalid" ? (
        <p data-testid="login-error" role="alert">
          이메일 또는 비밀번호가 올바르지 않습니다.
        </p>
      ) : null}

      <form action={login}>
        <label htmlFor="email">이메일</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">비밀번호</label>
        <input id="password" name="password" type="password" required />

        <button type="submit">로그인</button>
      </form>

      <section>
        <h2>빠른 로그인</h2>
        <p>
          동시 편집을 확인하려면 다른 탭에서 다른 사용자로 로그인하세요.
          비밀번호는 모두 <code>{SEED_PASSWORD}</code> 입니다.
        </p>
        <ul>
          {SEED_USERS.map((user) => (
            <li key={user.id}>
              <form action={login}>
                <input type="hidden" name="email" value={user.email} />
                <input type="hidden" name="password" value={SEED_PASSWORD} />
                <button type="submit" data-testid={`quick-login-${user.id}`}>
                  {user.displayName} ({user.email})
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
