import { redirect } from "next/navigation";

import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { DocumentSession } from "@/components/editor/document-session";
import { DocumentTitle } from "@/components/editor/document-title";
import { TopBar, type Breadcrumb } from "@/components/layout/top-bar";
import { currentUser } from "@/lib/auth";
import { documentNameForResource } from "@/lib/contracts/collaboration";
import {
  findResourceById,
  listResources,
  resolvePermissions,
} from "@/lib/store";
import { buildResourceTree, findResourcePath } from "@/lib/store/resource-tree";

/**
 * DOC-01 공동 문서 — UI 명세 §11
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; resourceId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { workspaceId, resourceId } = await params;
  const resource = findResourceById(resourceId);

  if (!resource || resource.type !== "DOCUMENT") {
    return (
      <EmptyState
        title="문서를 찾을 수 없습니다."
        description="주소가 바뀌었거나 페이지가 보관되었을 수 있습니다."
      />
    );
  }

  const permissions = resolvePermissions(resourceId, user.id);

  if (permissions.length === 0) {
    return (
      <EmptyState
        title={resource.title}
        description="이 페이지에 접근할 권한이 없습니다."
      />
    );
  }

  const path = findResourcePath(
    buildResourceTree(listResources(workspaceId)),
    resourceId,
  );

  // 마지막은 현재 문서 자신이라 제목으로 따로 쓴다.
  const breadcrumbs: Breadcrumb[] = path.slice(0, -1).map((node) => ({
    id: node.id,
    title: node.title,
    href: node.type === "DOCUMENT" ? `/w/${workspaceId}/doc/${node.id}` : null,
  }));

  const canEdit = permissions.includes("edit");

  return (
    <DocumentSession
      resourceId={resourceId}
      documentName={documentNameForResource(resourceId)}
      initialTitle={resource.title}
    >
      <TopBar breadcrumbs={breadcrumbs} title={resource.title} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* 본문 폭은 760~840px로 제한한다(§4). */}
        <div className="mx-auto w-full max-w-200 px-6 py-10 sm:px-10">
          <header className="mb-6">
            {resource.icon ? (
              <p aria-hidden className="mb-2 text-4xl">
                {resource.icon}
              </p>
            ) : null}
            <DocumentTitle
              key={resourceId}
              resourceId={resourceId}
              initialTitle={resource.title}
              canEdit={canEdit}
            />
            {!canEdit ? (
              <p role="note" className="text-warning mt-2 text-xs">
                읽기 전용입니다. 이 페이지를 편집할 권한이 없습니다.
              </p>
            ) : null}
          </header>

          <CollaborativeEditor
            currentUser={{
              displayName: user.displayName,
              cursorColor: user.cursorColor,
            }}
            canEdit={canEdit}
          />
        </div>
      </div>
    </DocumentSession>
  );
}

function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-10 text-center">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="text-text-secondary" role="alert">
        {description}
      </p>
    </div>
  );
}
