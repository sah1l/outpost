import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getSessionUser } from "@/lib/auth";

// In a layout so the sidebar stays put while moving between pages. With no valid
// session the page handles the redirect, because it knows where to send you back to.
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) return children;
  return <AppShell user={user}>{children}</AppShell>;
}
