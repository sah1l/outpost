import { getDoc, touchAnonExpiry } from "@/lib/docs";
import { notFound, servePublicDocFile } from "@/lib/serve";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (!doc || !doc.isPublic) return notFound();

  // Before any 304, so repeat viewers still keep an anonymous doc alive.
  void touchAnonExpiry(doc).catch(() => undefined);

  // A zip site's relative links only resolve from inside its own folder. Served from here,
  // "style.css" would point at /view/style.css. Relative Location so it survives the proxy.
  if (doc.type === "zip") {
    return new Response(null, {
      status: 302,
      headers: {
        location: `/view/${encodeURIComponent(slug)}/${encodeURIComponent(doc.entryFile)}`,
        "cache-control": "no-store",
      },
    });
  }

  return servePublicDocFile(req, doc, null);
}
