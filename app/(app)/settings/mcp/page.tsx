import { PageHeader } from "@/components/layout/page-header";
import { McpAccessTokens } from "@/components/mcp/access-tokens";
import { McpConnections } from "@/components/prototype/phase-pages";
import { SEED_WORKSPACE } from "@/lib/store/seed";

/**
 * SET-03 MCP 연결 — UI 명세 §22
 *
 * MCP는 양방향이다(아키텍처 §15). 두 방향은 이름만 같을 뿐 서로 다른
 * 시스템이라 화면에서도 나눠 놓는다.
 *
 * - 들어오는 연결: 외부 AI가 이 워크스페이스에 붙는다. 토큰을 발급한다.
 * - 나가는 연결: 워크스페이스 안의 AI가 외부 도구를 부른다. 서버를 등록한다.
 */
export default function McpSettingsPage() {
  return (
    <>
      <PageHeader
        title="MCP 연결"
        description="외부 AI를 이 워크스페이스에 연결하거나, 워크스페이스가 쓸 외부 도구를 등록합니다."
        backHref={`/w/${SEED_WORKSPACE.id}/settings/general`}
      />

      <main className="p-6">
        <div className="mx-auto max-w-3xl space-y-8">
          <McpAccessTokens />

          <section className="space-y-3">
            <div>
              <h2 className="font-semibold">외부 도구 연결</h2>
              <p className="text-text-secondary mt-1 text-xs">
                워크스페이스의 AI가 GitHub 같은 외부 MCP 서버를 호출합니다.
                기본 공유 범위는 PRIVATE이고, 도구별로 승인 정책을 정합니다.
              </p>
            </div>
            <McpConnections />
          </section>
        </div>
      </main>
    </>
  );
}
