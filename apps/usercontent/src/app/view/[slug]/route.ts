import { getDoc, touchAnonExpiry } from "@/lib/docs";
import { bucket } from "@/lib/gcs";
import { securityHeaders, contentTypeFor } from "@/lib/headers";
import { renderMarkdown } from "@/lib/render-md";

export const runtime = "nodejs";

function notFound(): Response {
  return new Response("Not found", {
    status: 404,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc || !doc.isPublic) return notFound();

  const file = bucket().file(doc.gcsPath);
  const [exists] = await file.exists();
  if (!exists) return notFound();

  void touchAnonExpiry(doc).catch(() => undefined);

  if (doc.type === "md") {
    const [buf] = await file.download();
    const html = await renderMarkdown(buf.toString("utf8"), doc.title);
    return new Response(html, {
      status: 200,
      headers: securityHeaders({ "content-type": "text/html; charset=utf-8" }),
    });
  }

  // html type (zip handled later at /view/[slug]/[...path])
  const [buf] = await file.download();
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: securityHeaders({ "content-type": contentTypeFor(doc.entryFile) }),
  });
}
