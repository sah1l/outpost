import { NextResponse } from "next/server";
import { canEditDoc, canEditWorkspaceDocs } from "@offsprint/shared";
import { getSessionUser, sessionOr401 } from "@/lib/auth";
import { docRoleFor, viewerFromSession } from "@/lib/access";
import {
  getDoc,
  deleteDoc,
  docForNonOwner,
  updateDoc,
  gcsPrefixFor,
  incrementUserStorage,
} from "@/lib/docs";
import { workspaceRoleFor } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  const user = await getSessionUser();
  if (user && doc.ownerId === user.uid) return NextResponse.json(doc);

  const role = user ? await docRoleFor(doc, viewerFromSession(user)) : null;
  if (!doc.isPublic && !role) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(docForNonOwner(doc));
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  const viewer = viewerFromSession(user);
  const role = await docRoleFor(doc, viewer);
  if (!canEditDoc(role)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as {
    isPublic?: boolean;
    title?: string;
    workspaceId?: string | null;
  } | null;
  if (!body) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const patch: { isPublic?: boolean; title?: string; workspaceId?: string | null } = {};

  // Editors can rewrite a doc but not decide who else sees it.
  if (typeof body.isPublic === "boolean") {
    if (role !== "owner") return NextResponse.json({ error: "only the owner can change visibility" }, { status: 403 });
    patch.isPublic = body.isPublic;
  }
  if (body.workspaceId !== undefined) {
    if (role !== "owner") return NextResponse.json({ error: "only the owner can move a doc" }, { status: 403 });
    if (body.workspaceId !== null) {
      if (typeof body.workspaceId !== "string" || !body.workspaceId) {
        return NextResponse.json({ error: "invalid workspace" }, { status: 400 });
      }
      const workspaceRole = await workspaceRoleFor(body.workspaceId, viewer);
      if (!canEditWorkspaceDocs(workspaceRole)) {
        return NextResponse.json({ error: "you can't add docs to that workspace" }, { status: 403 });
      }
    }
    patch.workspaceId = body.workspaceId;
  }
  if (typeof body.title === "string") {
    const trimmed = body.title.trim().slice(0, 200);
    if (!trimmed) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = trimmed;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  await updateDoc(slug, patch);
  const updated = await getDoc(slug);
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(role === "owner" ? updated : docForNonOwner(updated));
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ ok: true });
  if (doc.ownerId !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const prefix = gcsPrefixFor(slug, doc.ownerId);
  await deleteDoc(slug, prefix);
  if (doc.ownerId && doc.sizeBytes > 0) {
    await incrementUserStorage(doc.ownerId, -doc.sizeBytes);
  }
  return NextResponse.json({ ok: true });
}
