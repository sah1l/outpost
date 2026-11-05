import type { ReactNode } from "react";
import { AppShell } from "@/components/app/app-shell";
import { getSessionUser } from "@/lib/auth";

// With no valid session the page handles the redirect, because it knows which workspace you wanted.
export default async function WorkspacesLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) return children;
  return <AppShell user={user}>{children}</AppShell>;
}
