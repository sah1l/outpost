import type { DocRecord } from "@offsprint/shared";
import { ANON_DOC_TTL_DAYS } from "@offsprint/shared";
import { adminFirestore } from "./firebase-admin";

export async function getDoc(slug: string): Promise<DocRecord | null> {
  const snap = await adminFirestore().collection("docs").doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as DocRecord;
}

export async function touchAnonExpiry(doc: DocRecord): Promise<void> {
  if (doc.ownerId !== null) return;
  const newExpiry = Date.now() + ANON_DOC_TTL_DAYS * 24 * 60 * 60 * 1000;
  if (doc.expiresAt && newExpiry - doc.expiresAt < 24 * 60 * 60 * 1000) return;
  await adminFirestore().collection("docs").doc(doc.slug).update({ expiresAt: newExpiry });
}
