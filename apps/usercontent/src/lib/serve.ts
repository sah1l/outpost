import path from "node:path";
import { injectSandboxShim, type DocRecord } from "@offsprint/shared";
import { bucket } from "./gcs";
import { contentTypeFor, publicViewHeaders, securityHeaders } from "./headers";
import { renderMarkdown } from "./render-md";

// A signed viewing link must never end up in a shared cache or a search index.
export const PRIVATE_VIEW_HEADERS: Record<string, string> = {
  "Cache-Control": "private, no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

// Never cached: a 404 for a private doc must not stick after it's shared or made public.
export function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function objectPathFor(doc: DocRecord, requestedPath: string | null): string | null {
  if (doc.type !== "zip") {
    // A single-file doc has one file. Asking for anything else is a miss, not the doc again.
    if (requestedPath !== null && requestedPath !== doc.entryFile) return null;
    return doc.gcsPath;
  }
  const normalized = path.posix.normalize(requestedPath ?? doc.entryFile);
  if (normalized.startsWith("..") || normalized.startsWith("/")) return null;
  return `${doc.gcsPath.replace(/\/index\.html$/, "")}/${normalized}`;
}

// A repeat visit to an unchanged public doc costs a 304 instead of a storage read.
export async function servePublicDocFile(
  req: Request,
  doc: DocRecord,
  requestedPath: string | null,
): Promise<Response> {
  const headers = publicViewHeaders(doc, requestedPath);
  if (req.headers.get("if-none-match") === headers.ETag) {
    return new Response(null, { status: 304, headers: securityHeaders(headers) });
  }
  return serveDocFile(doc, requestedPath, headers);
}

// Callers decide whether this viewer may see the doc. This only serves it.
export async function serveDocFile(
  doc: DocRecord,
  requestedPath: string | null,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const objectPath = objectPathFor(doc, requestedPath);
  if (!objectPath) return notFound();

  const file = bucket().file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return notFound();
  const [buf] = await file.download();

  if (doc.type === "md") {
    const html = await renderMarkdown(buf.toString("utf8"), doc.title);
    return new Response(injectSandboxShim(html), {
      status: 200,
      headers: securityHeaders({ "content-type": "text/html; charset=utf-8", ...extraHeaders }),
    });
  }

  const contentType = contentTypeFor(doc.type === "zip" ? objectPath : doc.entryFile);
  const body = contentType.startsWith("text/html")
    ? injectSandboxShim(buf.toString("utf8"))
    : new Uint8Array(buf);
  return new Response(body, {
    status: 200,
    headers: securityHeaders({ "content-type": contentType, ...extraHeaders }),
  });
}
