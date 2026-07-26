import { PageHeader } from "@/components/layout/page-header";
import { SearchPage } from "@/components/prototype/phase-pages";
import { listResources } from "@/lib/store";
export default async function SearchRoute({ params }: { params: Promise<{ workspaceId: string }> }) { const { workspaceId } = await params; return <><PageHeader title="통합 검색" /><main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-3xl"><SearchPage workspaceId={workspaceId} resources={await listResources(workspaceId)} /></div></main></>; }
