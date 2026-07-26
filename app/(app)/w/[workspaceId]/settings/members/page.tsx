import { PageHeader } from "@/components/layout/page-header";
import { MembersManager } from "@/components/prototype/phase-pages";
import { listMembersWithUsers } from "@/lib/store";

export default async function MembersPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params;
  const data = await listMembersWithUsers(workspaceId);
  return <><PageHeader title="멤버" description={`${data.length}명이 함께하고 있습니다.`} /><main className="flex-1 overflow-y-auto p-6"><div className="mx-auto max-w-4xl"><MembersManager users={data.map((item) => item.user)} members={data.map((item) => ({ workspaceId: item.workspaceId, userId: item.userId, role: item.role, joinedAt: item.joinedAt }))} /></div></main></>;
}
