import { NextResponse } from "next/server";
import { canEditDoc, contentRevOf, MAX_UPLOAD_BYTES_USER } from "@offsprint/shared";
import { docRoleFor, viewerFromSession } from "@/lib/access";
import { sessionOr401 } from "@/lib/auth";
import { bucket } from "@/lib/gcs";
import { claimContentSave, getDoc, updateDoc, incrementUserStorage } from "@/lib/docs";

export const runtime = "nodejs";

// Custom headers rather than ETag and If-Match, because the CDN in front
// of the app can weaken an ETag when it compresses a response.
function expectedRevOf(req: Request): number | null {
  const raw = req.headers.get("x-expected-rev");
  if (!raw) return null;
  const rev = Number(raw);
  return Number.isFinite(rev) ? rev : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canEditDoc(await docRoleFor(doc, viewerFromSession(user)))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (doc.type === "zip") return NextResponse.json({ error: "zip not editable" }, { status: 400 });

  const [buf] = await bucket().file(doc.gcsPath).download();
  return new Response(buf.toString("utf8"), {
    status: 200,
    headers: {
      "content-type": doc.type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-content-rev": String(contentRevOf(doc)),
    },
  });
}

export async function PUT(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const doc = await getDoc(slug);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!canEditDoc(await docRoleFor(doc, viewerFromSession(user)))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (doc.type === "zip") return NextResponse.json({ error: "zip not editable" }, { status: 400 });

  const text = await req.text();
  const byteLen = Buffer.byteLength(text, "utf8");
  if (byteLen > MAX_UPLOAD_BYTES_USER) {
    return NextResponse.json({ error: "content too large" }, { status: 413 });
  }

  // With more than one editor, a save from a stale tab would silently wipe someone's work.
  const claim = await claimContentSave(slug, expectedRevOf(req));
  if (!claim.ok) {
    return NextResponse.json(
      { error: "someone else saved this doc after you opened it", rev: claim.currentRev },
      { status: 409 },
    );
  }

  const contentType = doc.type === "md" ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8";
  try {
    await bucket().file(doc.gcsPath).save(text, { contentType, resumable: false });
  } catch (e) {
    // Nothing changed, so don't let the retry look like someone else got in first.
    await updateDoc(slug, { contentUpdatedAt: claim.previousRev }).catch(() => undefined);
    throw e;
  }

  const delta = byteLen - doc.sizeBytes;
  await updateDoc(slug, { sizeBytes: byteLen });
  // Charged to the doc's owner, not whichever editor happened to save it.
  if (delta !== 0 && doc.ownerId) await incrementUserStorage(doc.ownerId, delta);

  return NextResponse.json({ ok: true, sizeBytes: byteLen, rev: claim.rev });
}
