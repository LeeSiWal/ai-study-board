import { redirect } from "next/navigation";

import { CollaborativeEditor } from "@/components/editor/collaborative-editor";
import { currentUser, signOut } from "@/lib/auth";
import { documentNameForResource } from "@/lib/contracts/collaboration";
import { findResourceById, resolvePermissions } from "@/lib/store";

/**
 * DOC-01 공동 문서 (Phase 0 최소 형태)
 *
 * 레이아웃과 상단 바는 Phase 1~2에서 UI 명세 §4·§6·§11에 맞춰 만든다.
 * 지금 확인하려는 것은 두 사용자가 같은 문서를 실제로 함께 편집하는가다.
 */
export default async function DocumentPage({
  params,
}: {
  params: Promise<{ workspaceId: string; resourceId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { resourceId } = await params;
  const resource = findResourceById(resourceId);

  if (!resource || resource.type !== "DOCUMENT") {
    return (
      <main style={{ maxWidth: 840, margin: "40px auto", padding: 24 }}>
        <h1>문서를 찾을 수 없습니다.</h1>
      </main>
    );
  }

  const permissions = resolvePermissions(resourceId, user.id);

  if (permissions.length === 0) {
    return (
      <main style={{ maxWidth: 840, margin: "40px auto", padding: 24 }}>
        <h1>{resource.title}</h1>
        <p role="alert">이 페이지에 접근할 권한이 없습니다.</p>
      </main>
    );
  }

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main style={{ maxWidth: 840, margin: "40px auto", padding: 24 }}>
      <header style={{ marginBottom: 24 }}>
        <p>
          접속: <strong data-testid="current-user">{user.displayName}</strong>{" "}
          · 권한: {permissions.join(", ")}
          <form action={logout} style={{ display: "inline", marginLeft: 12 }}>
            <button type="submit">로그아웃</button>
          </form>
        </p>
        <h1>{resource.title}</h1>
      </header>

      <CollaborativeEditor
        resourceId={resourceId}
        documentName={documentNameForResource(resourceId)}
        currentUser={{
          displayName: user.displayName,
          cursorColor: user.cursorColor,
        }}
        canEdit={permissions.includes("edit")}
      />
    </main>
  );
}
