import { Activity, FileText, PenLine, Upload, Users } from "lucide-react";
import Link from "next/link";

import { PageHeader } from "@/components/layout/page-header";
import { currentUser } from "@/lib/auth";
import { listResources } from "@/lib/store";

export default async function WorkspaceHome({ params }: { params: Promise<{ workspaceId: string }> }) {
  const user = await currentUser();
  const { workspaceId } = await params;
  const resources = listResources(workspaceId).filter((item) => item.type !== "FOLDER").slice(0, 6);
  const route = (type: string) => type === "DOCUMENT" ? "doc" : type === "WHITEBOARD" ? "board" : "file";
  return <><PageHeader title={`좋은 하루예요, ${user?.displayName}님`} description="AI 논문 스터디 · 매주 논문 한 편을 함께 읽고 정리합니다." /><main className="min-h-0 flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-5xl space-y-8">
    <section className="grid gap-3 sm:grid-cols-4">
      {[["새 문서", FileText], ["화이트보드", PenLine], ["자료 업로드", Upload], ["멤버 초대", Users]].map(([label, Icon]) => <button key={label as string} className="hover:border-primary flex items-center gap-3 rounded-xl border bg-surface p-4 text-left"><Icon className="text-primary size-5" /><span>{label as string}</span></button>)}
    </section>
    <section><h2 className="mb-3 text-lg font-semibold">최근 작업</h2><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{resources.map((resource) => <Link key={resource.id} href={`/w/${workspaceId}/${route(resource.type)}/${resource.id}`} className="hover:border-primary rounded-xl border bg-surface p-4"><p className="font-medium">{resource.title}</p><p className="text-text-secondary mt-2 text-xs">{resource.type} · 최근 수정</p></Link>)}</div></section>
    <section className="grid gap-4 lg:grid-cols-2"><div className="rounded-xl border bg-surface p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Activity className="size-4" /> 스터디 활동</h2><p>민지가 “Self-Attention 정리”를 수정했습니다.</p><p className="text-text-secondary mt-3">AI 요약 제안이 문서에 반영되었습니다.</p></div><div className="rounded-xl border bg-surface p-5"><h2 className="mb-4 flex items-center gap-2 font-semibold"><Users className="size-4" /> 멤버</h2><p>시월, 민지, 현우 외 3명</p><p className="text-success mt-2 text-xs">현재 3명 접속 중</p></div></section>
  </div></main></>;
}
