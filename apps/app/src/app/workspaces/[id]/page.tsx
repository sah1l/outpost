import { notFound, redirect } from "next/navigation";
import { resolveDocRole, verifiedEmailOf } from "@offsprint/shared";
import type { DocRow } from "@/components/docs/doc-table";
import { PageBody } from "@/components/ui/feedback";
import { viewerFromSession } from "@/lib/access";
import { getSessionUser, syncUserIdentity } from "@/lib/auth";
import { listWorkspaceDocs } from "@/lib/docs";
import { getWorkspace, listMembers, workspaceRoleFor } from "@/lib/workspaces";
import { WorkspaceShell } from "./workspace-shell";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  // Only named for someone who can see it, so a title can't reveal a workspace's name.
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return { title: "Workspace" };
  const role = await workspaceRoleFor(id, viewerFromSession(user));
  const workspace = role ? await getWorkspace(id) : null;
  return { title: workspace?.name ?? "Workspace" };
}

export default async function WorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/workspaces/${id}`)}`);

  const viewer = viewerFromSession(user);
  const workspace = await getWorkspace(id);
  const role = workspace ? await workspaceRoleFor(id, viewer) : null;
  if (!workspace || !role) notFound();

  await syncUserIdentity(user);
  const [docs, members] = await Promise.all([listWorkspaceDocs(id), listMembers(id)]);

  const rows: DocRow[] = docs.flatMap((doc) => {
    const docRole = resolveDocRole(doc, viewer, role);
    return docRole
      ? [
          {
            slug: doc.slug,
            title: doc.title,
            type: doc.type,
            isPublic: doc.isPublic,
            updatedAt: doc.updatedAt,
            role: docRole,
            // Who else it's shared with is the owner's business, not the workspace's.
            ...(docRole === "owner" ? { shareCount: doc.shares?.length ?? 0 } : {}),
          },
        ]
      : [];
  });

  return (
    <PageBody>
      <WorkspaceShell
        id={workspace.id}
        initialName={workspace.name}
        ownerEmail={workspace.ownerEmail}
        role={role}
        viewerEmail={verifiedEmailOf(user)}
        docs={rows}
        initialMembers={members.map((m) => ({ email: m.email, role: m.role }))}
      />
    </PageBody>
  );
}
