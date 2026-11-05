import type { ReactNode } from "react";
import { viewerFromSession } from "@/lib/access";
import type { SessionUser } from "@/lib/auth";
import { getUserStorageUsed } from "@/lib/docs";
import { listWorkspacesFor } from "@/lib/workspaces";
import { AppFrame } from "./app-frame";

export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const [workspaces, storageUsed] = await Promise.all([
    listWorkspacesFor(viewerFromSession(user)),
    getUserStorageUsed(user.uid),
  ]);
  return (
    <AppFrame
      user={{ email: user.email, displayName: user.displayName }}
      storageUsed={storageUsed}
      workspaces={workspaces.map((w) => ({ id: w.workspace.id, name: w.workspace.name }))}
    >
      {children}
    </AppFrame>
  );
}
