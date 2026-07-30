import { AuthError } from "next-auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";

import { SignupForm, type SignupState } from "@/components/auth/signup-form";
import { auth, signIn } from "@/lib/auth";
import { registerSchema } from "@/lib/contracts/auth";
import { getWorkspace } from "@/lib/store";
import { memberCount, registerUser } from "@/lib/store/register";
import { DEMO_DOCUMENT_ID } from "@/lib/store/seed";

/**
 * AUTH-02 회원가입 — UI 명세 §7
 *
 * 가입하면 시드 워크스페이스에 MEMBER로 합류한다. 지금 확인하려는 것이
 * 협업이라, 가입 직후 다른 사람이 있는 문서에 들어가야 동시 편집과 AI 제안을
 * 바로 시험할 수 있다.
 */

async function register(
  _state: SignupState,
  formData: FormData,
): Promise<SignupState> {
  "use server";

  const raw = {
    email: String(formData.get("email") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
  };

  const parsed = registerSchema.safeParse({
    ...raw,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const { fieldErrors } = z.flattenError(parsed.error);

    return {
      values: raw,
      fieldErrors: {
        email: fieldErrors.email?.[0],
        displayName: fieldErrors.displayName?.[0],
        password: fieldErrors.password?.[0],
      },
    };
  }

  const result = await registerUser(parsed.data);

  if (!result.ok) {
    // 어느 필드가 문제인지 그 옆에 붙인다(§8).
    return { values: raw, fieldErrors: { email: "이미 가입된 이메일입니다." } };
  }

  const workspace = await getWorkspace();

  try {
    // 가입 직후 바로 문서로 들여보낸다. 로그인을 한 번 더 하게 만들 이유가 없다.
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: `/w/${workspace.id}/doc/${DEMO_DOCUMENT_ID}`,
    });
  } catch (caught) {
    if (caught instanceof AuthError) {
      return {
        values: raw,
        formError: "가입은 됐지만 자동 로그인에 실패했습니다. 로그인해 주세요.",
      };
    }
    throw caught;
  }

  return {};
}

export default async function SignupPage() {
  const session = await auth();
  const workspace = await getWorkspace();

  if (session?.user) {
    redirect(`/w/${workspace.id}/doc/${DEMO_DOCUMENT_ID}`);
  }

  const members = await memberCount();

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
          <h1 className="text-xl font-semibold">함께 시작하기</h1>
          <p className="text-text-secondary mt-1">
            {workspace.name}에 {members}명이 함께하고 있습니다.
          </p>
        </div>

        <div className="border-border bg-surface rounded-xl border p-6">
          <SignupForm action={register} />

          <p className="text-text-secondary mt-5 text-center text-xs">
            이미 계정이 있으신가요?{" "}
            <Link href="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </p>
        </div>

        <p className="text-text-tertiary mt-4 text-center text-xs">
          가입하면 <strong>{workspace.name}</strong> 워크스페이스의 멤버가 되어
          문서를 함께 편집할 수 있습니다.
        </p>
      </div>
    </main>
  );
}
