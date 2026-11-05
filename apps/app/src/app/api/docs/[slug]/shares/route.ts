import { NextResponse } from "next/server";
import {
  canEditWorkspaceDocs,
  isValidEmail,
  normalizeEmail,
  type DocRecord,
  type ShareRole,
} from "@offsprint/shared";
import { viewerFromSession } from "@/lib/access";
import { sessionOr401, type SessionUser } from "@/lib/auth";
import { getDoc, removeDocShare, ShareLimitError, upsertDocShare } from "@/lib/docs";
import { listWorkspacesFor } from "@/lib/workspaces";

export const runtime = "nodejs";

type OwnerLookup = { user: SessionUser; doc: DocRecord } | NextResponse;

// Only a doc's owner sees or changes who it's shared with.
async function requireOwner(slug: string): Promise<OwnerLookup> {
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;
  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (doc.ownerId !== user.uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return { user, doc };
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const owner = await requireOwner(slug);
  if (owner instanceof NextResponse) return owner;

  const workspaces = await listWorkspacesFor(viewerFromSession(owner.user));
  return NextResponse.json({
    shares: owner.doc.shares ?? [],
    workspaceId: owner.doc.workspaceId ?? null,
    workspaces: workspaces
      .filter((w) => canEditWorkspaceDocs(w.role))
      .map((w) => ({ id: w.workspace.id, name: w.workspace.name })),
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const owner = await requireOwner(slug);
  if (owner instanceof NextResponse) return owner;

  const body = (await req.json().catch(() => null)) as { email?: string; role?: ShareRole } | null;
  const email = normalizeEmail(body?.email ?? "");
  if (!isValidEmail(email)) return NextResponse.json({ error: "enter a valid email" }, { status: 400 });
  if (body?.role !== "viewer" && body?.role !== "editor") {
    return NextResponse.json({ error: "role must be viewer or editor" }, { status: 400 });
  }
  if (email === normalizeEmail(owner.user.email)) {
    return NextResponse.json({ error: "you already own this doc" }, { status: 400 });
  }

  try {
    const shares = await upsertDocShare(slug, {
      email,
      role: body.role,
      addedBy: owner.user.uid,
      addedAt: Date.now(),
    });
    return NextResponse.json({ shares });
  } catch (e) {
    if (e instanceof ShareLimitError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const owner = await requireOwner(slug);
  if (owner instanceof NextResponse) return owner;

  const body = (await req.json().catch(() => null)) as { email?: string } | null;
  const email = normalizeEmail(body?.email ?? "");
  if (!email) return NextResponse.json({ error: "email is required" }, { status: 400 });

  return NextResponse.json({ shares: await removeDocShare(slug, email) });
}
