import { AlertTriangle, Check, FileText, PencilLine } from "lucide-react";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import { auth, currentUser } from "@/lib/auth";
import { checkAuthorizeRequest } from "@/lib/oauth/authorize";
import { issueAuthorizationCode } from "@/lib/oauth/core";
import { getWorkspace } from "@/lib/store";
import { headers } from "next/headers";

/**
 * AUTH-03 인가 동의 — 아키텍처 §15.4
 *
 * MCP 클라이언트가 사용자를 여기로 보낸다. 사용자는 이미 이 사이트에
 * 로그인해 있으므로 그 세션을 그대로 쓴다. 확인해야 할 것은 하나다 —
 * "이 프로그램에게 내 워크스페이스를 열어줄 것인가."
 *
 * 그래서 화면에 클라이언트 이름과 돌아갈 주소를 크게 적는다. 사용자가
 * 속아서 여기까지 왔다면 그 두 줄이 마지막 방어선이다.
 */

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const params = toSearchParams(raw);

  // 서버 액션이 닫아 잡는 값은 직렬화를 거쳐 되돌아온다. URLSearchParams는
  // 그 과정에서 메서드를 잃고 맨 객체가 된다. 문자열로 넘겨 액션 안에서
  // 다시 만든다.
  const query = params.toString();

  // 프록시 뒤에서도 실제 주소를 봐야 resource가 맞는다.
  const headerList = await headers();
  const origin = originFromHeaders(headerList);

  const check = await checkAuthorizeRequest(params, origin);

  if (check.kind === "bounce") redirect(check.location);
  if (check.kind === "halt") return <Halt {...check} />;

  const { request } = check;

  const session = await auth();

  if (!session?.user) {
    // 로그인 후 이 요청으로 정확히 돌아와야 한다. 문서로 보내 버리면
    // 사용자가 클라이언트에서 연결을 처음부터 다시 눌러야 한다.
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${query}`)}`);
  }

  const user = await currentUser();
  if (!user) redirect("/login");

  const workspace = await getWorkspace();

  async function approve() {
    "use server";

    // 폼에서 온 값을 믿지 않는다. 원래 쿼리로 처음부터 다시 검증한다.
    // 숨은 필드는 사용자가 고칠 수 있어서, 여기서 다시 보지 않으면 승인
    // 화면만 통과시키고 값은 바꿔치기할 수 있다.
    const revalidated = await checkAuthorizeRequest(
      new URLSearchParams(query),
      origin,
    );
    if (revalidated.kind !== "consent") redirect(`/oauth/authorize?${query}`);

    const approver = await currentUser();
    if (!approver) redirect("/login");

    const code = await issueAuthorizationCode({
      clientId: revalidated.request.clientId,
      userId: approver.id,
      redirectUri: revalidated.request.redirectUri,
      codeChallenge: revalidated.request.codeChallenge,
      codeChallengeMethod: revalidated.request.codeChallengeMethod,
      resource: revalidated.request.resource,
    });

    const target = new URL(revalidated.request.redirectUri);
    target.searchParams.set("code", code);
    if (revalidated.request.state) {
      target.searchParams.set("state", revalidated.request.state);
    }

    redirect(target.toString());
  }

  async function deny() {
    "use server";

    const target = new URL(request.redirectUri);
    target.searchParams.set("error", "access_denied");
    target.searchParams.set("error_description", "사용자가 거부했습니다.");
    if (request.state) target.searchParams.set("state", request.state);

    redirect(target.toString());
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="border-border bg-surface w-full max-w-md rounded-xl border p-6">
        <h1 className="text-lg font-semibold">
          <span className="text-primary">{request.clientName}</span>에 연결할까요?
        </h1>
        <p className="text-text-secondary mt-1 text-sm">
          {user.displayName}님의 <strong>{workspace.name}</strong> 워크스페이스에
          접근합니다.
        </p>

        <ul className="border-border mt-5 space-y-3 rounded-lg border p-4 text-sm">
          <li className="flex gap-2.5">
            <FileText aria-hidden className="text-text-tertiary mt-0.5 size-4 shrink-0" />
            <span>
              <strong>페이지를 읽습니다.</strong>
              <br />
              <span className="text-text-secondary">
                볼 수 있는 문서의 목록과 본문, 검색 결과.
              </span>
            </span>
          </li>
          <li className="flex gap-2.5">
            <PencilLine aria-hidden className="text-text-tertiary mt-0.5 size-4 shrink-0" />
            <span>
              {/* 이 한 줄이 사용자의 불안을 크게 줄인다. AI가 문서를 몰래
                  고칠 수 없다는 사실을 승인 직전에 말해줘야 한다. */}
              <strong>수정은 제안으로만 남깁니다.</strong>
              <br />
              <span className="text-text-secondary">
                직접 고치지 않습니다. 반영하려면 사람이 승인해야 합니다.
              </span>
            </span>
          </li>
        </ul>

        <p className="text-text-tertiary mt-4 text-xs">
          승인하면 아래 주소로 돌아갑니다.
          <br />
          <code className="break-all">{request.redirectUri}</code>
        </p>

        <div className="mt-6 flex gap-2">
          <form action={deny} className="flex-1">
            <Button type="submit" variant="outline" className="w-full">
              거부
            </Button>
          </form>
          <form action={approve} className="flex-1">
            <Button type="submit" className="w-full gap-1.5">
              <Check aria-hidden className="size-4" />
              연결 승인
            </Button>
          </form>
        </div>
      </div>
    </main>
  );
}

function Halt({ title, detail }: { title: string; detail: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="border-danger/30 bg-danger/5 w-full max-w-md rounded-xl border p-6">
        <h1 className="text-danger flex items-center gap-2 font-semibold">
          <AlertTriangle aria-hidden className="size-4" />
          {title}
        </h1>
        <p className="text-text-secondary mt-2 text-sm">{detail}</p>
        <p className="text-text-tertiary mt-4 text-xs">
          {/* 여기서 돌아가기 링크를 주지 않는다. 돌아갈 주소를 믿을 수 없어서
              이 화면에 선 것이기 때문이다. */}
          안전을 위해 이 화면에서 자동으로 돌아가지 않습니다. 연결을 시작한
          프로그램으로 직접 돌아가세요.
        </p>
      </div>
    </main>
  );
}

function toSearchParams(
  raw: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "string") params.set(key, value);
    // 같은 키가 두 번 오면 어느 쪽을 쓸지 정해야 한다. 첫 번째만 쓴다.
    else if (Array.isArray(value) && value[0]) params.set(key, value[0]);
  }

  return params;
}

function originFromHeaders(list: Headers): string {
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "";
  const proto = list.get("x-forwarded-proto") ?? "http";

  return `${proto}://${host}`;
}
