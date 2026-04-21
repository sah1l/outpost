import { FieldValue, type Firestore } from "firebase-admin/firestore";
import type { DocRecord, DocType } from "@offsprint/shared";
import { adminFirestore } from "./firebase-admin";
import { bucket } from "./gcs";

const COLLECTION = "docs";

function db(): Firestore {
  return adminFirestore();
}

export async function getDoc(slug: string): Promise<DocRecord | null> {
  const snap = await db().collection(COLLECTION).doc(slug).get();
  if (!snap.exists) return null;
  return snap.data() as DocRecord;
}

export async function createDoc(record: DocRecord): Promise<void> {
  await db().collection(COLLECTION).doc(record.slug).create(record);
}

export async function updateDoc(slug: string, patch: Partial<DocRecord>): Promise<void> {
  await db().collection(COLLECTION).doc(slug).set(
    { ...patch, updatedAt: Date.now() },
    { merge: true },
  );
}

export async function deleteDoc(slug: string, gcsPrefix: string): Promise<void> {
  await bucket().deleteFiles({ prefix: gcsPrefix, force: true });
  await db().collection(COLLECTION).doc(slug).delete();
}

export async function listUserDocs(ownerId: string, limit = 100): Promise<DocRecord[]> {
  const snap = await db()
    .collection(COLLECTION)
    .where("ownerId", "==", ownerId)
    .orderBy("updatedAt", "desc")
    .limit(limit)
    .get();
  return snap.docs.map((d) => d.data() as DocRecord);
}

export function gcsPrefixFor(slug: string, ownerId: string | null): string {
  return ownerId ? `user/${ownerId}/${slug}` : `anon/${slug}`;
}

export function entryFileFor(type: DocType, filename: string): string {
  if (type === "zip") return "index.html";
  return filename;
}

export async function incrementUserStorage(uid: string, delta: number): Promise<void> {
  await db()
    .collection("users")
    .doc(uid)
    .set({ storageUsedBytes: FieldValue.increment(delta) }, { merge: true });
}
