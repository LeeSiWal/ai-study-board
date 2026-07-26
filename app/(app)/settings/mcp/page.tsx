import { PageHeader } from "@/components/layout/page-header";
import { McpConnections } from "@/components/prototype/phase-pages";
import { SEED_WORKSPACE } from "@/lib/store/seed";
export default function McpSettingsPage() { return <><PageHeader title="MCP 연결" description="도구별 권한과 외부 전송 내용을 검토합니다." backHref={`/w/${SEED_WORKSPACE.id}/settings/general`} /><main className="p-6"><div className="mx-auto max-w-3xl"><McpConnections /></div></main></>; }
