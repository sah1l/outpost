import { NextResponse } from "next/server";
import {
  isValidEmail,
  MAX_WORKSPACE_MEMBERS,
  normalizeEmail,
  verifiedEmailOf,
  type ShareRole,
} from "@offsprint/shared";
import { sessionOr401 } from "@/lib/auth";
import { getWorkspace, listMembers, removeMember, setMember } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const workspace = await getWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (workspace.ownerId !== user.uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { email?: string; role?: ShareRole } | null;
  const email = normalizeEmail(body?.email ?? "");
  if (!isValidEmail(email)) return NextResponse.json({ error: "enter a valid email" }, { status: 400 });
  if (body?.role !== "viewer" && body?.role !== "editor") {
    return NextResponse.json({ error: "role must be viewer or editor" }, { status: 400 });
  }
  if (email === normalizeEmail(workspace.ownerEmail)) {
    return NextResponse.json({ error: "that's the workspace owner" }, { status: 400 });
  }

  const members = await listMembers(id);
  if (members.length >= MAX_WORKSPACE_MEMBERS && !members.some((m) => m.email === email)) {
    return NextResponse.json(
      { error: `a workspace can have at most ${MAX_WORKSPACE_MEMBERS} members` },
      { status: 400 },
    );
  }

  await setMember(id, email, body.role, user.uid);
  return NextResponse.json({ members: await listMembers(id) });
}

// The owner can remove anyone, and members can remove themselves.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const workspace = await getWorkspace(id);
  if (!workspace) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  const isOwner = workspace.ownerId === user.uid;
  if (!isOwner && verifiedEmailOf(user) !== email) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await removeMember(id, email);
  return NextResponse.json({ members: isOwner ? await listMembers(id) : [] });
}
