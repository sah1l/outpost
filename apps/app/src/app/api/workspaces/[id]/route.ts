import { NextResponse } from "next/server";
import { MAX_WORKSPACE_NAME_LENGTH } from "@offsprint/shared";
import { sessionOr401 } from "@/lib/auth";
import { deleteWorkspace, getWorkspace, renameWorkspace } from "@/lib/workspaces";

export const runtime = "nodejs";

async function requireWorkspaceOwner(id: string): Promise<NextResponse | null> {
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;
  const workspace = await getWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (workspace.ownerId !== user.uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await requireWorkspaceOwner(id);
  if (denied) return denied;

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = (body?.name ?? "").trim().slice(0, MAX_WORKSPACE_NAME_LENGTH);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  await renameWorkspace(id, name);
  return NextResponse.json({ ok: true, name });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const denied = await requireWorkspaceOwner(id);
  if (denied) return denied;

  await deleteWorkspace(id);
  return NextResponse.json({ ok: true });
}
