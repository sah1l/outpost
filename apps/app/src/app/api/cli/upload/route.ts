import { NextResponse } from "next/server";
import {
  MAX_UPLOAD_BYTES_USER,
  type CliUploadFormat,
  type CliUploadResponse,
  type DocRecord,
  type DocType,
} from "@offsprint/shared";
import { env } from "@/env";
import { requireCliUser, cliAuthErrorResponse } from "@/lib/cli-auth";
import { bucket } from "@/lib/gcs";
import { createDoc, gcsPrefixFor, incrementUserStorage } from "@/lib/docs";
import { allocateSlug, allocateContentAwareSlug } from "@/lib/slug";
import { contentTypeForPath } from "@/lib/mime";

export const runtime = "nodejs";
// Inline text/file upload — small bodies only. Cap matches MAX_UPLOAD_BYTES_USER.
export const maxDuration = 60;

interface JsonBody {
  text?: string;
  format?: CliUploadFormat;
  title?: string;
  isPublic?: boolean;
}

function safeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function detectType(filename: string, contentType: string): DocType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".md") || lower.endsWith(".markdown") || contentType === "text/markdown") return "md";
  if (lower.endsWith(".html") || lower.endsWith(".htm") || contentType === "text/html") return "html";
  return null;
}

function entryFileForFormat(format: CliUploadFormat, title: string): string {
  const base = safeFilename(title || "document").replace(/\.[^.]+$/, "") || "document";
  return `${base}.${format === "md" ? "md" : "html"}`;
}

async function persist(opts: {
  uid: string;
  type: DocType;
  filename: string;
  buffer: Buffer;
  title: string;
  isPublic: boolean;
}): Promise<CliUploadResponse> {
  const size = opts.buffer.byteLength;
  if (size <= 0 || size > MAX_UPLOAD_BYTES_USER) {
    throw new HttpError(413, "file too large");
  }

  // Stage under a throwaway slug, then claim a friendly slug from content.
  const stagingSlug = await allocateSlug();
  const prefix = gcsPrefixFor(stagingSlug, opts.uid);
  const objectPath = `${prefix}/${opts.filename}`;
  const file = bucket().file(objectPath);
  await file.save(opts.buffer, {
    contentType: contentTypeForPath(opts.filename),
    resumable: false,
  });

  const friendlySlug = await allocateContentAwareSlug({
    title: opts.title,
    content: opts.buffer.toString("utf8"),
  });

  const now = Date.now();
  const record: DocRecord = {
    slug: friendlySlug,
    ownerId: opts.uid,
    anonSessionId: null,
    type: opts.type,
    gcsPath: objectPath,
    entryFile: opts.filename,
    title: opts.title.slice(0, 200),
    isPublic: opts.isPublic,
    sizeBytes: size,
    createdAt: now,
    updatedAt: now,
    expiresAt: null,
  };
  await Promise.all([createDoc(record), incrementUserStorage(opts.uid, size)]);

  const base = env.appBaseUrlNoTrailingSlash();
  return {
    slug: record.slug,
    url: `${base}/s/${record.slug}`,
    title: record.title,
    type: record.type,
  };
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
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
      if (!body?.text || !body.format) {
        return NextResponse.json({ error: "invalid request: text and format are required" }, { status: 400 });
      }
      if (body.format !== "html" && body.format !== "md") {
        return NextResponse.json({ error: "format must be 'html' or 'md'" }, { status: 400 });
      }
      const title = (body.title?.trim() || (body.format === "md" ? "Untitled.md" : "Untitled.html")).slice(0, 200);
      const filename = entryFileForFormat(body.format, title);
      const buf = Buffer.from(body.text, "utf8");
      const result = await persist({
        uid: principal.uid,
        type: body.format,
        filename,
        buffer: buf,
        title,
        isPublic: body.isPublic ?? false,
      });
      return NextResponse.json(result);
    }

    if (contentType.startsWith("multipart/form-data")) {
      const form = await req.formData();
      const fileEntry = form.get("file");
      if (!(fileEntry instanceof File)) {
        return NextResponse.json({ error: "missing 'file' field" }, { status: 400 });
      }
      const detected = detectType(fileEntry.name, fileEntry.type || "");
      if (!detected || detected === "zip") {
        return NextResponse.json({ error: "only .html and .md uploads are supported via this endpoint" }, { status: 400 });
      }
      const titleField = form.get("title");
      const isPublicField = form.get("isPublic");
      const filename = safeFilename(fileEntry.name);
      const buf = Buffer.from(await fileEntry.arrayBuffer());
      const result = await persist({
        uid: principal.uid,
        type: detected,
        filename,
        buffer: buf,
        title: typeof titleField === "string" && titleField ? titleField : fileEntry.name,
        isPublic: isPublicField === "true",
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
