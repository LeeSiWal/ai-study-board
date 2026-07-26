import { notFound, redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { currentUser, signOut } from "@/lib/auth";
import { findMembership, getWorkspace, listResources } from "@/lib/store";
import { buildResourceTree } from "@/lib/store/resource-tree";

/**
 * 워크스페이스 셸.
 *
 * 사이드바와 페이지 트리는 워크스페이스 안 모든 화면이 공유하므로 레이아웃에
 * 둔다. 문서를 옮겨 다녀도 트리가 다시 마운트되지 않는다.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { workspaceId } = await params;
  const workspace = await getWorkspace();

  if (workspace.id !== workspaceId) notFound();
  if (!await findMembership(workspaceId, user.id)) notFound();

  const tree = buildResourceTree(await listResources(workspaceId));

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <AppShell
      workspace={{ id: workspace.id, name: workspace.name }}
      viewer={{ displayName: user.displayName, email: user.email }}
      tree={tree}
      signOutAction={signOutAction}
    >
      {children}
    </AppShell>
  );
}
