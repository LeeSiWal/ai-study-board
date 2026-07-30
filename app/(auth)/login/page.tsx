import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { LoginForm, type LoginState } from "@/components/auth/login-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { auth, signIn } from "@/lib/auth";
import {
  DEMO_DOCUMENT_ID,
  SEED_PASSWORD,
  SEED_USERS,
  SEED_WORKSPACE,
} from "@/lib/store/seed";

/**
 * AUTH-01 로그인 — UI 명세 §8
 *
 * 화면 중앙의 단일 패널. 과도한 마케팅 영역은 두지 않는다.
 */

const DEMO_PATH = `/w/${SEED_WORKSPACE.id}/doc/${DEMO_DOCUMENT_ID}`;

const credentialsSchema = z.object({
  email: z.email({ message: "이메일 형식을 확인해주세요." }),
  password: z.string().min(1, { message: "비밀번호를 입력해주세요." }),
});

async function login(
  _state: LoginState,
  formData: FormData,
): Promise<LoginState> {
  "use server";

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      fieldErrors: {
        email: fieldErrors.email?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: DEMO_PATH });
  } catch (caught) {
    // signIn은 성공 시 리다이렉트를 throw 한다. 그건 통과시켜야 한다.
    if (caught instanceof AuthError) {
      return { formError: "이메일 또는 비밀번호가 올바르지 않습니다." };
    }
    throw caught;
  }

  return {};
}

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect(DEMO_PATH);

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div
            aria-hidden
            className="bg-primary text-primary-foreground mx-auto mb-3 flex size-10 items-center justify-center rounded-xl text-lg font-semibold"
          >
            A
          </div>
          <h1 className="text-xl font-semibold">AI 스터디</h1>
          <p className="text-text-secondary mt-1">
            함께 공부하고, AI와 정리하세요.
          </p>
        </div>

        <div className="border-border bg-surface rounded-xl border p-6">
          <LoginForm action={login} />

          <div className="my-5 flex items-center gap-3">
            <Separator className="flex-1" />
            <span className="text-text-tertiary text-xs">또는</span>
            <Separator className="flex-1" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            disabled
            title="곧 제공됩니다."
          >
            Google로 로그인
          </Button>

          <p className="text-text-secondary mt-5 text-center text-xs">
            계정이 없으신가요?{" "}
            <Link href="/signup" className="text-primary hover:underline">
              회원가입
            </Link>
          </p>
        </div>

        <QuickLogin />
      </div>
    </main>
  );
}

/**
 * 개발용 빠른 로그인.
 *
 * 동시 편집을 확인하려면 탭마다 다른 사용자로 들어가야 하는데, 매번
 * 자격 증명을 입력하는 것은 번거롭다. 실제 제품에는 없는 화면이다.
 */
function QuickLogin() {
  async function quickLogin(formData: FormData) {
    "use server";

    await signIn("credentials", {
      email: formData.get("email"),
      password: SEED_PASSWORD,
      redirectTo: DEMO_PATH,
    });
  }

  return (
    <section className="border-border mt-6 rounded-xl border border-dashed p-4">
      <h2 className="text-text-secondary text-xs font-medium">
        빠른 로그인 (개발용)
      </h2>
      <p className="text-text-tertiary mt-1 text-xs">
        동시 편집을 확인하려면 다른 탭에서 다른 사용자로 들어가세요.
      </p>

      <ul className="mt-3 flex flex-wrap gap-1.5">
        {SEED_USERS.map((user) => (
          <li key={user.id}>
            <form action={quickLogin}>
              <input type="hidden" name="email" value={user.email} />
              <Button
                type="submit"
                variant="outline"
                size="sm"
                data-testid={`quick-login-${user.id}`}
                className="gap-1.5"
              >
                <span
                  aria-hidden
                  className="size-2 rounded-full"
                  style={{ backgroundColor: user.cursorColor }}
                />
                {user.displayName}
              </Button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}
