import { NextResponse } from "next/server";
import { MAX_UPLOAD_BYTES_USER } from "@offsprint/shared";
import type { InitUploadRequest, InitUploadResponse, DocType } from "@offsprint/shared";
import { requireUser, AuthError } from "@/lib/auth";
import { bucket } from "@/lib/gcs";
import { allocateSlug } from "@/lib/slug";
import { gcsPrefixFor, entryFileFor } from "@/lib/docs";

export const runtime = "nodejs";

const SIGNED_URL_EXPIRES_MS = 10 * 60 * 1000;

function detectType(filename: string, contentType: string): DocType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".zip") || contentType === "application/zip") return "zip";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return null;
}

function safeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as InitUploadRequest | null;
  if (!body || !body.filename || !body.contentType || !body.sizeBytes) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (body.sizeBytes <= 0 || body.sizeBytes > MAX_UPLOAD_BYTES_USER) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }

  const type = detectType(body.filename, body.contentType);
  if (!type) {
    return NextResponse.json({ error: "unsupported file type" }, { status: 400 });
  }

  const slug = await allocateSlug();
  const cleanName = safeFilename(body.filename);
  const prefix = gcsPrefixFor(slug, user.uid);
  const objectPath = type === "zip" ? `${prefix}/_upload.zip` : `${prefix}/${entryFileFor(type, cleanName)}`;

  const file = bucket().file(objectPath);
  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + SIGNED_URL_EXPIRES_MS,
    contentType: body.contentType,
    extensionHeaders: {
      "x-goog-content-length-range": `0,${MAX_UPLOAD_BYTES_USER}`,
    },
  });

  const response: InitUploadResponse = {
    slug,
    signedUrl,
    gcsPath: objectPath,
    requiredHeaders: {
      "content-type": body.contentType,
      "x-goog-content-length-range": `0,${MAX_UPLOAD_BYTES_USER}`,
    },
  };
  return NextResponse.json(response);
}
