import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
export default async function PersonalSettingsLayout({ children }: { children: React.ReactNode }) { const user = await currentUser(); if (!user) redirect("/login"); return <div className="min-h-dvh bg-background">{children}</div>; }
