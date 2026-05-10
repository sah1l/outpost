import { NextResponse } from "next/server";
import {
  MAX_UPLOAD_BYTES_USER,
  type CliUploadFormat,
  type CliUploadResponse,
  type DocRecord,
} from "@offsprint/shared";
import { env } from "@/env";
import { requireCliUser, cliAuthErrorResponse } from "@/lib/cli-auth";
import { bucket } from "@/lib/gcs";
import { getDoc, updateDoc, incrementUserStorage } from "@/lib/docs";

export const runtime = "nodejs";
export const maxDuration = 60;

interface JsonBody {
  slug?: string;
  text?: string;
  format?: CliUploadFormat;
  title?: string;
  isPublic?: boolean;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function resolveSlug(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, "");
  const match = /\/s\/([^/?#]+)/.exec(trimmed);
  return (match ? match[1]! : trimmed).trim();
}

function detectFormatFromFilename(name: string): CliUploadFormat | null {
  const lower = name.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return null;
}

async function loadOwnedEditableDoc(slug: string, uid: string): Promise<DocRecord> {
  const doc = await getDoc(slug);
  if (!doc) throw new HttpError(404, "doc not found");
  if (doc.ownerId !== uid) throw new HttpError(403, "forbidden");
  if (doc.type === "zip") throw new HttpError(400, "zip docs are not editable via CLI");
  return doc;
}

async function applyUpdate(opts: {
  doc: DocRecord;
  uid: string;
  body: Buffer | null;
  title: string | undefined;
  isPublic: boolean | undefined;
}): Promise<CliUploadResponse> {
  const { doc, uid, body } = opts;
  const patch: Partial<DocRecord> = {};

  if (body) {
    const size = body.byteLength;
    if (size <= 0 || size > MAX_UPLOAD_BYTES_USER) throw new HttpError(413, "file too large");
    const contentType = doc.type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";
    await bucket().file(doc.gcsPath).save(body, { contentType, resumable: false });
    const delta = size - doc.sizeBytes;
    patch.sizeBytes = size;
    if (delta !== 0) await incrementUserStorage(uid, delta);
  }

  if (typeof opts.title === "string") {
    const trimmed = opts.title.trim().slice(0, 200);
    if (!trimmed) throw new HttpError(400, "title cannot be empty");
    patch.title = trimmed;
  }
  if (typeof opts.isPublic === "boolean") patch.isPublic = opts.isPublic;

  if (Object.keys(patch).length === 0) {
    throw new HttpError(400, "nothing to update (provide text/file, title, or isPublic)");
  }

  await updateDoc(doc.slug, patch);

  const finalTitle = patch.title ?? doc.title;
  const base = env.appBaseUrlNoTrailingSlash();
  return {
    slug: doc.slug,
    url: `${base}/s/${doc.slug}`,
    title: finalTitle,
    type: doc.type,
  };
}

export async function POST(req: Request) {
  let principal;
  try {
    principal = await requireCliUser(req);
  } catch (e) {
    const authResponse = cliAuthErrorResponse(e);
    if (authResponse) return authResponse;
    throw e;
  }

  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  try {
    if (contentType.startsWith("application/json")) {
      const body = (await req.json().catch(() => null)) as JsonBody | null;
      if (!body?.slug) {
        return NextResponse.json({ error: "invalid request: slug is required" }, { status: 400 });
      }
      const slug = resolveSlug(body.slug);
      if (!slug) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

      const doc = await loadOwnedEditableDoc(slug, principal.uid);

      let buffer: Buffer | null = null;
      if (typeof body.text === "string") {
        if (body.format && body.format !== doc.type) {
          return NextResponse.json(
            { error: `format mismatch: doc is '${doc.type}', got '${body.format}'` },
            { status: 400 },
          );
        }
        buffer = Buffer.from(body.text, "utf8");
      }

      const result = await applyUpdate({
        doc,
        uid: principal.uid,
        body: buffer,
        title: body.title,
        isPublic: typeof body.isPublic === "boolean" ? body.isPublic : undefined,
      });
      return NextResponse.json(result);
    }

    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const slugField = form.get("slug");
      if (typeof slugField !== "string" || !slugField) {
        return NextResponse.json({ error: "missing 'slug' field" }, { status: 400 });
      }
      const slug = resolveSlug(slugField);
      if (!slug) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

      const doc = await loadOwnedEditableDoc(slug, principal.uid);

      let buffer: Buffer | null = null;
      const fileEntry = form.get("file");
      if (fileEntry instanceof File) {
        const detected = detectFormatFromFilename(fileEntry.name);
        if (detected && detected !== doc.type) {
          return NextResponse.json(
            { error: `format mismatch: doc is '${doc.type}', file looks like '${detected}'` },
            { status: 400 },
          );
        }
        buffer = Buffer.from(await fileEntry.arrayBuffer());
      }

      const titleField = form.get("title");
      const isPublicField = form.get("isPublic");
      const title = typeof titleField === "string" ? titleField : undefined;
      let isPublic: boolean | undefined;
      if (isPublicField === "true") isPublic = true;
      else if (isPublicField === "false") isPublic = false;

      const result = await applyUpdate({
        doc,
        uid: principal.uid,
        body: buffer,
        title,
        isPublic,
      });
      return NextResponse.json(result);
    }

    return NextResponse.json(
      { error: "content-type must be application/json or multipart/form-data" },
      { status: 415 },
    );
  } catch (e) {
    if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
