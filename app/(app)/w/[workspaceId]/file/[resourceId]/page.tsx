import { PageHeader } from "@/components/layout/page-header";
import { FileDetail } from "@/components/prototype/phase-pages";
import { findResourceById } from "@/lib/store";
export default async function FilePage({ params }: { params: Promise<{ workspaceId: string; resourceId: string }> }) { const { resourceId } = await params; const resource = findResourceById(resourceId); return <><PageHeader title="자료 상세" description="처리 상태, 미리보기와 AI 활용 범위를 확인합니다." /><main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-6xl"><FileDetail title={resource?.title ?? "자료"} /></div></main></>; }
