import { NextResponse } from "next/server";
import type { DocRecord, DocType } from "@offsprint/shared";
import { ANON_DOC_TTL_DAYS, MAX_UPLOAD_BYTES_ANON } from "@offsprint/shared";
import { bucket } from "@/lib/gcs";
import { allocateSlug, allocateContentAwareSlug } from "@/lib/slug";
import { createDoc, gcsPrefixFor } from "@/lib/docs";
import { extractZip, ZipExtractionError } from "@/lib/zip";
import { contentTypeForPath } from "@/lib/mime";
import { checkAndIncrementAnonUploadQuota, extractClientIp } from "@/lib/rate-limit";

export const runtime = "nodejs";

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
  const ip = extractClientIp(req);
  const quota = await checkAndIncrementAnonUploadQuota(ip);
  if (!quota.ok) {
    return NextResponse.json({ error: "rate limit: max 5 uploads per day from your address" }, { status: 429 });
  }

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid form" }, { status: 400 });

  const file = form.get("file");
  const titleRaw = form.get("title");
  const sessionId = form.get("sessionId");
  const makePublic = form.get("makePublic");

  if (!(file instanceof File)) return NextResponse.json({ error: "missing file" }, { status: 400 });
  if (typeof sessionId !== "string" || !sessionId) return NextResponse.json({ error: "missing sessionId" }, { status: 400 });

  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES_ANON) {
    return NextResponse.json({ error: `file too large (max ${MAX_UPLOAD_BYTES_ANON} bytes)` }, { status: 413 });
  }

  const type = detectType(file.name, file.type);
  if (!type) return NextResponse.json({ error: "unsupported file type" }, { status: 400 });

  // Use a random staging slug for GCS paths; Firestore ID is picked later
  // from content via MiniMax.
  const stagingSlug = await allocateSlug();
  const prefix = gcsPrefixFor(stagingSlug, null);
  const now = Date.now();
  const title = (typeof titleRaw === "string" && titleRaw.trim() ? titleRaw.trim() : file.name).slice(0, 200);
  const expiresAt = now + ANON_DOC_TTL_DAYS * 24 * 60 * 60 * 1000;
  const isPublic = makePublic === "true";

  const buf = Buffer.from(await file.arrayBuffer());

  if (type === "zip") {
    let files;
    try {
      files = await extractZip(buf);
    } catch (e) {
      if (e instanceof ZipExtractionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // Kick off slug generation in parallel with GCS uploads.
    const indexEntry = files.find((f) => f.path.toLowerCase() === "index.html");
    const slugPromise = allocateContentAwareSlug({
      title,
      content: indexEntry?.buffer.toString("utf8"),
    });

    let totalSize = 0;
    const uploadPromise = Promise.all(
      files.map(async (f) => {
        totalSize += f.size;
        await bucket().file(`${prefix}/files/${f.path}`).save(f.buffer, {
          contentType: contentTypeForPath(f.path),
          resumable: false,
        });
      }),
    );

    const [friendlySlug] = await Promise.all([slugPromise, uploadPromise]);

    const record: DocRecord = {
      slug: friendlySlug,
      ownerId: null,
      anonSessionId: sessionId,
      type: "zip",
      gcsPath: `${prefix}/files/index.html`,
      entryFile: "index.html",
      title,
      isPublic,
      sizeBytes: totalSize,
      createdAt: now,
      updatedAt: now,
      expiresAt,
    };
    await createDoc(record);
    return NextResponse.json({ slug: friendlySlug, isPublic });
  }

  const entryFile = safeFilename(file.name);
  const objectPath = `${prefix}/${entryFile}`;

  // Kick off slug generation in parallel with the GCS upload.
  const slugPromise = allocateContentAwareSlug({
    title,
    content: buf.toString("utf8"),
  });
  const uploadPromise = bucket().file(objectPath).save(buf, {
    contentType: type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
    resumable: false,
  });

  const [friendlySlug] = await Promise.all([slugPromise, uploadPromise]);

  const record: DocRecord = {
    slug: friendlySlug,
    ownerId: null,
    anonSessionId: sessionId,
    type,
    gcsPath: objectPath,
    entryFile,
    title,
    isPublic,
    sizeBytes: file.size,
    createdAt: now,
    updatedAt: now,
    expiresAt,
  };
  await createDoc(record);
  return NextResponse.json({ slug: friendlySlug, isPublic });
}
