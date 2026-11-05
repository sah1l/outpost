import {
  CONTENT_TOKEN_TTL_MS,
  readDocRole,
  readViewer,
  signContentToken,
  verifiedEmailOf,
  type DocRecord,
  type DocRole,
  type DocViewer,
} from "@offsprint/shared";
import { env } from "@/env";
import type { SessionUser } from "./auth";
import { adminFirestore } from "./firebase-admin";

export function viewerFromSession(user: SessionUser): DocViewer {
  return { uid: user.uid, verifiedEmail: verifiedEmailOf(user) };
}

export function viewerFromUid(uid: string): Promise<DocViewer> {
  return readViewer(adminFirestore(), uid);
}

export function docRoleFor(doc: DocRecord, viewer: DocViewer): Promise<DocRole | null> {
  return readDocRole(adminFirestore(), doc, viewer);
}

function viewBase(slug: string): string {
  return `${env.usercontentBaseUrl().replace(/\/$/, "")}/view/${encodeURIComponent(slug)}`;
}

export function publicViewUrl(doc: DocRecord): string {
  // A zip site has to load from inside its folder for its relative links to resolve.
  return doc.type === "zip"
    ? `${viewBase(doc.slug)}/${encodeURIComponent(doc.entryFile)}`
    : viewBase(doc.slug);
}

export async function privateViewUrl(doc: DocRecord, uid: string): Promise<string> {
  const token = await signContentToken(env.contentTokenSecret(), {
    uid,
    slug: doc.slug,
    expiresAt: Date.now() + CONTENT_TOKEN_TTL_MS,
  });
  const base = `${viewBase(doc.slug)}/~${token}`;
  return doc.type === "zip" ? `${base}/${encodeURIComponent(doc.entryFile)}` : base;
}
