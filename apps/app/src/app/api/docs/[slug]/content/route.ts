import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES_USER } from "@offsprint/shared";
import { requireUser, AuthError } from "@/lib/auth";
import { bucket } from "@/lib/gcs";
import { getDoc, updateDoc, incrementUserStorage } from "@/lib/docs";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
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
  if (doc.type === "zip") return NextResponse.json({ error: "zip not editable" }, { status: 400 });

  const [buf] = await bucket().file(doc.gcsPath).download();
  return new Response(buf.toString("utf8"), {
    status: 200,
    headers: {
      "content-type": doc.type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
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
  if (doc.type === "zip") return NextResponse.json({ error: "zip not editable" }, { status: 400 });

  const text = await req.text();
  const byteLen = Buffer.byteLength(text, "utf8");
  if (byteLen > MAX_UPLOAD_BYTES_USER) {
    return NextResponse.json({ error: "content too large" }, { status: 413 });
  }

  const contentType = doc.type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";
  await bucket()
    .file(doc.gcsPath)
    .save(text, { contentType, resumable: false });

  const delta = byteLen - doc.sizeBytes;
  await updateDoc(slug, { sizeBytes: byteLen });
  if (delta !== 0) await incrementUserStorage(user.uid, delta);

  return NextResponse.json({ ok: true, sizeBytes: byteLen });
}
