import { PageHeader } from "@/components/layout/page-header";
import { AiConnections } from "@/components/prototype/phase-pages";
import { SEED_WORKSPACE } from "@/lib/store/seed";
export default function AiSettingsPage() { return <><PageHeader title="개인 AI 연결" description="개인 자격 증명은 워크스페이스에 자동 공유되지 않습니다." backHref={`/w/${SEED_WORKSPACE.id}/settings/general`} /><main className="p-6"><div className="mx-auto max-w-3xl"><AiConnections /></div></main></>; }
