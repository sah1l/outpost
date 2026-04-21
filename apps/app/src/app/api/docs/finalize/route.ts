import { NextResponse } from "next/server";
import type { DocRecord, DocType } from "@offsprint/shared";
import { MAX_UPLOAD_BYTES_USER } from "@offsprint/shared";
import { requireUser, AuthError } from "@/lib/auth";
import { bucket } from "@/lib/gcs";
import { createDoc, getDoc, gcsPrefixFor, incrementUserStorage } from "@/lib/docs";
import { extractZip, ZipExtractionError } from "@/lib/zip";
import { contentTypeForPath } from "@/lib/mime";
import { allocateContentAwareSlug } from "@/lib/slug";

export const runtime = "nodejs";

interface FinalizeBody {
  slug: string;
  type: DocType;
  title?: string;
  filename: string;
}

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as FinalizeBody | null;
  if (!body || !body.slug || !body.type || !body.filename) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const existing = await getDoc(body.slug);
  if (existing) {
    return NextResponse.json({ error: "slug already finalized" }, { status: 409 });
  }

  // GCS prefix uses the staging slug (client-visible from init); Firestore doc ID
  // can be a friendly content-aware slug picked here.
  const stagingPrefix = gcsPrefixFor(body.slug, user.uid);
  const now = Date.now();
  const title = (body.title?.trim() || body.filename).slice(0, 200);

  if (body.type === "zip") {
    const stagedPath = `${stagingPrefix}/_upload.zip`;
    const stagedFile = bucket().file(stagedPath);
    const [exists] = await stagedFile.exists();
    if (!exists) return NextResponse.json({ error: "upload not found" }, { status: 404 });

    const [meta] = await stagedFile.getMetadata();
    const zipSize = Number(meta.size ?? 0);
    if (!zipSize || zipSize > MAX_UPLOAD_BYTES_USER) {
      return NextResponse.json({ error: "invalid upload size" }, { status: 400 });
    }

    const [zipBuf] = await stagedFile.download();
    let files;
    try {
      files = await extractZip(zipBuf);
    } catch (e) {
      await stagedFile.delete({ ignoreNotFound: true });
      if (e instanceof ZipExtractionError) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    // Kick off slug generation in parallel with the extracted-file uploads.
    const indexEntry = files.find((f) => f.path.toLowerCase() === "index.html");
    const slugPromise = allocateContentAwareSlug({
      title,
      content: indexEntry?.buffer.toString("utf8"),
    });

    let totalSize = 0;
    const uploadPromise = Promise.all(
      files.map(async (f) => {
        totalSize += f.size;
        const dest = bucket().file(`${stagingPrefix}/files/${f.path}`);
        await dest.save(f.buffer, { contentType: contentTypeForPath(f.path), resumable: false });
      }),
    );

    const [friendlySlug] = await Promise.all([slugPromise, uploadPromise]);
    await stagedFile.delete({ ignoreNotFound: true });

    const record: DocRecord = {
      slug: friendlySlug,
      ownerId: user.uid,
      anonSessionId: null,
      type: "zip",
      gcsPath: `${stagingPrefix}/files/index.html`,
      entryFile: "index.html",
      title,
      isPublic: false,
      sizeBytes: totalSize,
      createdAt: now,
      updatedAt: now,
      expiresAt: null,
    };
    await createDoc(record);
    await incrementUserStorage(user.uid, totalSize);
    return NextResponse.json({ slug: record.slug });
  }

  const entryFile = body.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const objectPath = `${stagingPrefix}/${entryFile}`;
  const [exists] = await bucket().file(objectPath).exists();
  if (!exists) return NextResponse.json({ error: "upload not found" }, { status: 404 });

  const [meta] = await bucket().file(objectPath).getMetadata();
  const size = Number(meta.size ?? 0);
  if (!size || size > MAX_UPLOAD_BYTES_USER) {
    return NextResponse.json({ error: "invalid upload size" }, { status: 400 });
  }

  const [contentBuf] = await bucket().file(objectPath).download();
  const friendlySlug = await allocateContentAwareSlug({
    title,
    content: contentBuf.toString("utf8"),
  });

  const record: DocRecord = {
    slug: friendlySlug,
    ownerId: user.uid,
    anonSessionId: null,
    type: body.type,
    gcsPath: objectPath,
    entryFile,
    title,
    isPublic: false,
    sizeBytes: size,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
  await createDoc(record);
  await incrementUserStorage(user.uid, size);
  return NextResponse.json({ slug: record.slug });
}
