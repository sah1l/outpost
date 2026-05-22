import path from "node:path";
import { getDoc, touchAnonExpiry } from "@/lib/docs";
import { bucket } from "@/lib/gcs";
import {
  securityHeaders,
  contentTypeFor,
  computeETag,
  viewCacheHeaders,
  NOT_FOUND_CACHE_HEADERS,
} from "@/lib/headers";

export const runtime = "nodejs";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      ...NOT_FOUND_CACHE_HEADERS,
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path: segments } = await params;
  const doc = await getDoc(slug);
  if (!doc || !doc.isPublic || doc.type !== "zip") return notFound();

  const requested = segments.join("/");
  const normalized = path.posix.normalize(requested);
  if (normalized.startsWith("..") || normalized.startsWith("/") || normalized.includes("/..")) {
    return notFound();
  }

  const etag = computeETag(doc, normalized);

  void touchAnonExpiry(doc).catch(() => undefined);

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: viewCacheHeaders(etag) });
  }

  const prefix = doc.gcsPath.replace(/\/index\.html$/, "");
  const objectPath = `${prefix}/${normalized}`;
  const file = bucket().file(objectPath);
  const [exists] = await file.exists();
  if (!exists) return notFound();

  const [buf] = await file.download();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: securityHeaders({
      "content-type": contentTypeFor(normalized),
      ...viewCacheHeaders(etag),
    }),
  });
}
