import { redirect } from "next/navigation";

import { PageHeader } from "@/components/layout/page-header";
import { Whiteboard } from "@/components/whiteboard/whiteboard";
import { currentUser } from "@/lib/auth";
import { findResourceById, resolvePermissions } from "@/lib/store";
import { readWhiteboard } from "@/lib/store/whiteboards";

export default async function BoardPage({
  params,
}: {
  params: Promise<{ workspaceId: string; resourceId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { resourceId } = await params;
  const resource = await findResourceById(resourceId);
  if (!resource || resource.type !== "WHITEBOARD") {
    return <p role="alert" className="m-auto">화이트보드를 찾을 수 없습니다.</p>;
  }

  const permissions = await resolvePermissions(resourceId, user.id);
  if (!permissions.includes("view")) {
    return <p role="alert" className="m-auto">이 화이트보드에 접근할 권한이 없습니다.</p>;
  }

  const { scene } = await readWhiteboard(resourceId);

  return (
    <>
      <PageHeader
        title={resource.title}
        description="도형, 손그림, 텍스트와 이미지로 아이디어를 함께 정리합니다."
      />
      <main className="min-h-0 flex-1 overflow-hidden p-3">
        <Whiteboard
          resourceId={resourceId}
          initialScene={scene}
          canEdit={permissions.includes("edit")}
        />
      </main>
    </>
  );
}
