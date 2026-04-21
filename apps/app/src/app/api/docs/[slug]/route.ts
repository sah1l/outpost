import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { getDoc, deleteDoc, updateDoc, gcsPrefixFor } from "@/lib/docs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  let user = null;
  try {
    user = await requireUser();
  } catch {
    // unauthenticated
  }

  if (!doc.isPublic && doc.ownerId !== user?.uid) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(doc);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }
  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (doc.ownerId !== user.uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as { isPublic?: boolean; title?: string } | null;
  if (!body) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const patch: { isPublic?: boolean; title?: string } = {};
  if (typeof body.isPublic === "boolean") patch.isPublic = body.isPublic;
  if (typeof body.title === "string") {
    const trimmed = body.title.trim().slice(0, 200);
    if (!trimmed) return NextResponse.json({ error: "title cannot be empty" }, { status: 400 });
    patch.title = trimmed;
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: "nothing to update" }, { status: 400 });

  await updateDoc(slug, patch);
  const updated = await getDoc(slug);
  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }
  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ ok: true });
  if (doc.ownerId !== user.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const prefix = gcsPrefixFor(slug, doc.ownerId);
  await deleteDoc(slug, prefix);
  return NextResponse.json({ ok: true });
}
