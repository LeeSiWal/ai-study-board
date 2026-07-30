"use client";

import { Loader2 } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * 회원가입 폼 — UI 명세 §8의 규칙을 따른다
 *
 * 오류는 토스트가 아니라 해당 필드 아래에 적는다. 무엇을 고쳐야 하는지가
 * 입력 지점 옆에 있어야 한다.
 */

export interface SignupState {
  fieldErrors?: {
    email?: string;
    displayName?: string;
    password?: string;
  };
  formError?: string;
  /**
   * 사용자가 방금 입력한 값.
   *
   * React 19는 폼 액션이 끝나면 폼을 초기화한다. 되돌려 주지 않으면 검증에
   * 실패할 때마다 전부 다시 입력해야 한다. 비밀번호는 돌려주지 않는다.
   */
  values?: { email?: string; displayName?: string };
}

interface SignupFormProps {
  action: (state: SignupState, formData: FormData) => Promise<SignupState>;
}

export function SignupForm({ action }: SignupFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form
      action={formAction}
      className="space-y-4"
      noValidate
      // 액션이 끝나면 React가 폼을 비운다. key를 바꿔 되돌린 값으로
      // 다시 그리게 한다.
      key={`${state.values?.email ?? ""}|${state.values?.displayName ?? ""}`}
    >
      {state.formError ? (
        <p
          role="alert"
          data-testid="signup-error"
          className="border-danger/30 bg-danger/5 text-danger rounded-md border px-3 py-2 text-xs"
        >
          {state.formError}
        </p>
      ) : null}

      <Field
        id="displayName"
        label="이름"
        placeholder="문서에서 이렇게 보입니다"
        autoComplete="name"
        defaultValue={state.values?.displayName ?? ""}
        error={state.fieldErrors?.displayName}
      />

      <Field
        id="email"
        label="이메일"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        defaultValue={state.values?.email ?? ""}
        error={state.fieldErrors?.email}
      />

      <Field
        id="password"
        label="비밀번호"
        type="password"
        autoComplete="new-password"
        description="8자 이상"
        error={state.fieldErrors?.password}
      />

      {/* 비동기 동작 중에는 진행 상태를 보이고 중복 제출을 막는다(§24). */}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 aria-hidden className="size-4 animate-spin" />
            가입 중…
          </>
        ) : (
          "가입하고 시작하기"
        )}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  description,
  ...input
}: {
  id: string;
  label: string;
  error?: string;
  description?: string;
} & React.ComponentProps<typeof Input>) {
  return (
    <div className="space-y-1.5">
      {/* 레이블을 플레이스홀더로 대체하지 않는다(§24). */}
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...input}
      />
      {error ? (
        <p id={`${id}-error`} className="text-danger text-xs">
          {error}
        </p>
      ) : description ? (
        <p className="text-text-tertiary text-xs">{description}</p>
      ) : null}
    </div>
  );
}
