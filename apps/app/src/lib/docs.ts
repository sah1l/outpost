import { FieldValue, type Firestore } from "firebase-admin/firestore";
import {
  contentRevOf,
  MAX_DOC_SHARES,
  type DocRecord,
  type DocShare,
  type DocType,
} from "@offsprint/shared";
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

// The next two sort in memory so they need no new composite index. The limit is applied
// before sorting, which is fine at this scale but would need an index for big teams.
function newestFirst(docs: DocRecord[]): DocRecord[] {
  return docs.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function listDocsSharedWith(verifiedEmail: string, limit = 200): Promise<DocRecord[]> {
  const snap = await db()
    .collection(COLLECTION)
    .where("sharedWithEmails", "array-contains", verifiedEmail)
    .limit(limit)
    .get();
  return newestFirst(snap.docs.map((d) => d.data() as DocRecord));
}

export async function listWorkspaceDocs(workspaceId: string, limit = 200): Promise<DocRecord[]> {
  const snap = await db()
    .collection(COLLECTION)
    .where("workspaceId", "==", workspaceId)
    .limit(limit)
    .get();
  return newestFirst(snap.docs.map((d) => d.data() as DocRecord));
}

export function gcsPrefixFor(slug: string, ownerId: string | null): string {
  return ownerId ? `user/${ownerId}/${slug}` : `anon/${slug}`;
}

export function entryFileFor(type: DocType, filename: string): string {
  if (type === "zip") return "index.html";
  return filename;
}

export async function getUserStorageUsed(uid: string): Promise<number> {
  const snap = await db().collection("users").doc(uid).get();
  return Number(snap.data()?.storageUsedBytes ?? 0);
}

export async function incrementUserStorage(uid: string, delta: number): Promise<void> {
  await db()
    .collection("users")
    .doc(uid)
    .set({ storageUsedBytes: FieldValue.increment(delta) }, { merge: true });
}

type OwnerOnlyField = "shares" | "sharedWithEmails" | "workspaceId" | "anonSessionId" | "gcsPath";

// What anyone other than the owner gets: no collaborator emails, workspace or storage internals.
export function docForNonOwner(doc: DocRecord): Omit<DocRecord, OwnerOnlyField> {
  const view: Partial<DocRecord> = { ...doc };
  delete view.shares;
  delete view.sharedWithEmails;
  delete view.workspaceId;
  delete view.anonSessionId;
  delete view.gcsPath;
  return view as Omit<DocRecord, OwnerOnlyField>;
}

export class ShareLimitError extends Error {}

// Transactions, because two people changing a doc's shares at once must not lose one change.
// These don't touch updatedAt: sharing a doc shouldn't reorder anyone's dashboard.
async function changeShares(
  slug: string,
  change: (current: DocShare[]) => DocShare[],
): Promise<DocShare[]> {
  const ref = db().collection(COLLECTION).doc(slug);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new Error("doc not found");
    const shares = change((snap.data() as DocRecord).shares ?? []);
    tx.set(
      ref,
      { shares, sharedWithEmails: shares.map((s) => s.email) },
      { merge: true },
    );
    return shares;
  });
}

export function upsertDocShare(slug: string, share: DocShare): Promise<DocShare[]> {
  return changeShares(slug, (current) => {
    const others = current.filter((s) => s.email !== share.email);
    if (others.length >= MAX_DOC_SHARES) {
      throw new ShareLimitError(`a doc can be shared with at most ${MAX_DOC_SHARES} people`);
    }
    return [...others, share];
  });
}

export function removeDocShare(slug: string, email: string): Promise<DocShare[]> {
  return changeShares(slug, (current) => current.filter((s) => s.email !== email));
}

export type ContentSaveClaim =
  | { ok: true; rev: number; previousRev: number }
  | { ok: false; currentRev: number };

// Checks nobody else saved since the caller loaded the doc, and marks this save as the latest.
// Done in a transaction before the file is written, so of two simultaneous saves only one wins.
export async function claimContentSave(
  slug: string,
  expectedRev: number | null,
): Promise<ContentSaveClaim> {
  const ref = db().collection(COLLECTION).doc(slug);
  return db().runTransaction(async (tx): Promise<ContentSaveClaim> => {
    const snap = await tx.get(ref);
    const currentRev = contentRevOf(snap.data() as DocRecord);
    if (expectedRev !== null && expectedRev !== currentRev) return { ok: false, currentRev };
    const now = Date.now();
    const rev = Math.max(now, currentRev + 1);
    tx.set(ref, { contentUpdatedAt: rev, updatedAt: now }, { merge: true });
    return { ok: true, rev, previousRev: currentRev };
  });
}
