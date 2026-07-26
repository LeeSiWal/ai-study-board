import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { WorkspaceSettings } from "@/components/prototype/phase-pages";

export default async function GeneralSettings({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  return <><PageHeader title="워크스페이스 설정" description="일반 정보, AI 정책과 데이터 정책을 관리합니다." /><main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-3xl space-y-4"><nav className="flex gap-2 text-xs"><Link className="rounded-full border px-3 py-2" href={`/w/${workspaceId}/settings/members`}>멤버</Link><Link className="rounded-full border px-3 py-2" href="/settings/ai">개인 AI</Link><Link className="rounded-full border px-3 py-2" href="/settings/mcp">MCP</Link></nav><WorkspaceSettings /></div></main></>;
}
