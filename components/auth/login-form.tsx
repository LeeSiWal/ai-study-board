"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 로그인 폼 — UI 명세 §8
 *
 * 오류는 토스트가 아니라 해당 필드 아래에 구체적으로 적는다. 무엇을 고쳐야
 * 하는지가 입력 지점 옆에 있어야 한다.
 */

export interface LoginState {
  /** 필드별 오류. 없으면 빈 객체. */
  fieldErrors?: { email?: string; password?: string };
  /** 폼 전체에 해당하는 오류. 자격 증명 실패나 네트워크 오류. */
  formError?: string;
}

interface LoginFormProps {
  action: (state: LoginState, formData: FormData) => Promise<LoginState>;
}

export function LoginForm({ action }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {state.formError ? (
        <p
          role="alert"
          data-testid="login-error"
          className="border-danger/30 bg-danger/5 text-danger rounded-md border px-3 py-2 text-xs"
        >
          {state.formError}
        </p>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="email">이메일</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          aria-invalid={!!state.fieldErrors?.email}
          aria-describedby={
            state.fieldErrors?.email ? "email-error" : undefined
          }
        />
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-danger text-xs">
            {state.fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label htmlFor="password">비밀번호</Label>
          <button
            type="button"
            disabled
            title="곧 제공됩니다."
            className="text-text-tertiary text-xs disabled:cursor-not-allowed"
          >
            비밀번호 찾기
          </button>
        </div>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          aria-invalid={!!state.fieldErrors?.password}
          aria-describedby={
            state.fieldErrors?.password ? "password-error" : undefined
          }
        />
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-danger text-xs">
            {state.fieldErrors.password}
          </p>
        ) : null}
      </div>

      {/* 비동기 동작 중에는 진행 상태를 보이고 중복 제출을 막는다(§24). */}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            로그인 중…
          </>
        ) : (
          "로그인"
        )}
      </Button>
    </form>
  );
}
