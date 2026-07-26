import { redirect } from "next/navigation";

import { auth } from "@/lib/auth";
import { DEMO_DOCUMENT_ID, SEED_WORKSPACE } from "@/lib/store/seed";

export default async function RootPage() {
  const session = await auth();

  if (!session?.user) redirect("/login");
  redirect(`/w/${SEED_WORKSPACE.id}/doc/${DEMO_DOCUMENT_ID}`);
}
