import { roleForToken } from "@/lib/access";
import { getDoc, touchAnonExpiry } from "@/lib/docs";
import { notFound, PRIVATE_VIEW_HEADERS, serveDocFile, servePublicDocFile } from "@/lib/serve";

export const runtime = "nodejs";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; path: string[] }> },
) {
  const { slug, path: segments } = await params;
  const doc = await getDoc(slug);
  if (!doc) return notFound();

  // /view/<slug>/~<token>/<file>: a signed-in viewer sent here by the app. The token sits in
  // the path, not the query, so a zip site's relative links keep carrying it.
  const first = segments[0];
  if (first?.startsWith("~")) {
    const role = await roleForToken(doc, first.slice(1));
    if (!role) return notFound();
    return serveDocFile(doc, segments.slice(1).join("/") || null, PRIVATE_VIEW_HEADERS);
  }

  if (!doc.isPublic) return notFound();
  void touchAnonExpiry(doc).catch(() => undefined);
  return servePublicDocFile(req, doc, segments.join("/"));
}
