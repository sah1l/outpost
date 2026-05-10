import { NextResponse } from "next/server";
import type { CliDeleteRequest, CliDeleteResponse } from "@offsprint/shared";
import { requireCliUser, cliAuthErrorResponse } from "@/lib/cli-auth";
import {
  getDoc,
  deleteDoc,
  gcsPrefixFor,
  incrementUserStorage,
} from "@/lib/docs";
import { resolveSlug } from "@/lib/slug";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let principal;
  try {
    principal = await requireCliUser(req);
  } catch (e) {
    const authResponse = cliAuthErrorResponse(e);
    if (authResponse) return authResponse;
    throw e;
  }

  const body = (await req.json().catch(() => null)) as CliDeleteRequest | null;
  if (!body?.slug) {
    return NextResponse.json({ error: "invalid request: slug is required" }, { status: 400 });
  }
  const slug = resolveSlug(body.slug);
  if (!slug) return NextResponse.json({ error: "invalid slug" }, { status: 400 });

  const doc = await getDoc(slug);
  // Idempotent: a missing doc is a successful no-op, matching the web DELETE.
  if (!doc) {
    const response: CliDeleteResponse = { slug, ok: true };
    return NextResponse.json(response);
  }
  if (doc.ownerId !== principal.uid) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const prefix = gcsPrefixFor(slug, doc.ownerId);
  await deleteDoc(slug, prefix);
  if (doc.ownerId && doc.sizeBytes > 0) {
    await incrementUserStorage(doc.ownerId, -doc.sizeBytes);
  }

  const response: CliDeleteResponse = { slug, ok: true };
  return NextResponse.json(response);
}
