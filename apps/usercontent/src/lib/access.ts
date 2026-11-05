import {
  readDocRole,
  readViewer,
  verifyContentToken,
  type DocRecord,
  type DocRole,
} from "@offsprint/shared";
import { env } from "@/env";
import { adminFirestore } from "./firebase-admin";

// usercontent has no sessions and never reads a cookie. A signed token in the URL is the
// only way to a private doc, and what the viewer may do is looked up fresh every time.
export async function roleForToken(doc: DocRecord, token: string): Promise<DocRole | null> {
  const uid = await verifyContentToken(env.contentTokenSecret(), token, doc.slug);
  if (!uid) return null;
  const db = adminFirestore();
  return readDocRole(db, doc, await readViewer(db, uid));
}
