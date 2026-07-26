import { PageHeader } from "@/components/layout/page-header";
import { Whiteboard } from "@/components/prototype/phase-pages";
import { findResourceById } from "@/lib/store";
export default async function BoardPage({ params }: { params: Promise<{ workspaceId: string; resourceId: string }> }) { const { resourceId } = await params; const resource = findResourceById(resourceId); return <><PageHeader title={resource?.title ?? "화이트보드"} description="공동 아이디어를 시각적으로 정리합니다." /><main className="flex-1 overflow-hidden p-4"><Whiteboard title={resource?.title ?? "화이트보드"} /></main></>; }
