import { NextResponse } from "next/server";
import type { DocRecord, DocType } from "@offsprint/shared";
import { MAX_UPLOAD_BYTES_USER } from "@offsprint/shared";
import { requireUser, AuthError } from "@/lib/auth";
import { bucket } from "@/lib/gcs";
import { createDoc, gcsPrefixFor, incrementUserStorage } from "@/lib/docs";
import { allocateContentAwareSlug } from "@/lib/slug";

export const runtime = "nodejs";
export const maxDuration = 60;

interface CreateBody {
  type?: DocType;
  title?: string;
  content?: string;
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as CreateBody | null;
  if (!body || (body.type !== "html" && body.type !== "md")) {
    return NextResponse.json({ error: "type must be 'html' or 'md'" }, { status: 400 });
  }
  if (typeof body.content !== "string") {
    return NextResponse.json({ error: "content must be a string" }, { status: 400 });
  }

  const type = body.type;
  const content = body.content;
  const byteLen = Buffer.byteLength(content, "utf8");
  if (byteLen > MAX_UPLOAD_BYTES_USER) {
    return NextResponse.json({ error: "content too large" }, { status: 413 });
  }

  const title = (body.title?.trim() || "Untitled").slice(0, 200);

  const slug = await allocateContentAwareSlug({ title, content });
  const entryFile = type === "md" ? "index.md" : "index.html";
  const objectPath = `${gcsPrefixFor(slug, user.uid)}/${entryFile}`;
  const contentType = type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";

  await bucket()
    .file(objectPath)
    .save(Buffer.from(content, "utf8"), { contentType, resumable: false });

  const now = Date.now();
  const record: DocRecord = {
    slug,
    ownerId: user.uid,
    anonSessionId: null,
    type,
    gcsPath: objectPath,
    entryFile,
    title,
    isPublic: false,
    sizeBytes: byteLen,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
  await createDoc(record);
  await incrementUserStorage(user.uid, byteLen);

  return NextResponse.json({ slug });
}
