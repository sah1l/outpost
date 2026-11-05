import { getDoc, touchAnonExpiry } from "@/lib/docs";
import { bucket } from "@/lib/gcs";
import {
  securityHeaders,
  contentTypeFor,
  computeETag,
  viewCacheHeaders,
  NOT_FOUND_CACHE_HEADERS,
} from "@/lib/headers";
import { renderMarkdown } from "@/lib/render-md";

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

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc || !doc.isPublic) return notFound();

  const etag = computeETag(doc);

  // touchAnonExpiry still runs on 304s — repeat viewers should keep anon docs alive.
  void touchAnonExpiry(doc).catch(() => undefined);

  if (req.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: viewCacheHeaders(etag) });
  }

  const file = bucket().file(doc.gcsPath);
  const [exists] = await file.exists();
  if (!exists) return notFound();

  if (doc.type === "md") {
    const [buf] = await file.download();
    const html = await renderMarkdown(buf.toString("utf8"), doc.title);
    return new Response(html, {
      status: 200,
      headers: securityHeaders({
        "content-type": "text/html; charset=utf-8",
        ...viewCacheHeaders(etag),
      }),
    });
  }

  // html type (zip handled later at /view/[slug]/[...path])
  const [buf] = await file.download();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: securityHeaders({
      "content-type": contentTypeFor(doc.entryFile),
      ...viewCacheHeaders(etag),
    }),
  });
}
