import type {
  DocRecord,
  DocRole,
  ShareRole,
  UserRecord,
  WorkspaceMember,
  WorkspaceRecord,
  WorkspaceRole,
} from "./types";

// The one place that decides who can do what. Both the app and usercontent call
// these, so the two hosts can't disagree. Firestore is passed in so this package
// stays free of firebase-admin, because the CLI and browser bundles import it too.

export interface DocViewer {
  uid: string;
  // Null unless the sign-in provider vouched for the address. Grants are keyed by
  // email, so an unverified address must never match one: Microsoft sign-ins, for
  // instance, can carry an address the tenant admin typed in rather than a mailbox
  // the person proved they own.
  verifiedEmail: string | null;
}

interface FirestoreSnapshot {
  exists: boolean;
  data(): unknown;
}

export interface FirestoreReader {
  collection(path: string): {
    doc(id: string): { get(): Promise<FirestoreSnapshot> };
  };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email);
}

export function verifiedEmailOf(user: {
  email?: string | null;
  emailVerified?: boolean;
}): string | null {
  return user.email && user.emailVerified === true ? normalizeEmail(user.email) : null;
}

export function workspaceMemberId(workspaceId: string, email: string): string {
  return `${workspaceId}__${encodeURIComponent(normalizeEmail(email))}`;
}

export function resolveDocRole(
  doc: Pick<DocRecord, "ownerId" | "shares">,
  viewer: DocViewer,
  workspaceRole: WorkspaceRole | null,
): DocRole | null {
  if (doc.ownerId !== null && doc.ownerId === viewer.uid) return "owner";

  // Owning a workspace doesn't make you owner of the docs in it: only a doc's
  // owner can delete it, publish it or change who it's shared with.
  let role: ShareRole | null =
    workspaceRole === null ? null : workspaceRole === "viewer" ? "viewer" : "editor";

  if (viewer.verifiedEmail) {
    const share = doc.shares?.find((s) => s.email === viewer.verifiedEmail);
    if (share && (role === null || share.role === "editor")) role = share.role;
  }
  return role;
}

export function canEditDoc(role: DocRole | null): boolean {
  return role === "owner" || role === "editor";
}

export function canEditWorkspaceDocs(role: WorkspaceRole | null): boolean {
  return role === "owner" || role === "editor";
}

export async function readViewer(db: FirestoreReader, uid: string): Promise<DocViewer> {
  const snap = await db.collection("users").doc(uid).get();
  const user = snap.exists ? (snap.data() as Partial<UserRecord>) : null;
  return { uid, verifiedEmail: user ? verifiedEmailOf(user) : null };
}

export async function readWorkspaceRole(
  db: FirestoreReader,
  workspaceId: string,
  viewer: DocViewer,
): Promise<WorkspaceRole | null> {
  const workspace = await db.collection("workspaces").doc(workspaceId).get();
  if (!workspace.exists) return null;
  if ((workspace.data() as WorkspaceRecord).ownerId === viewer.uid) return "owner";
  if (!viewer.verifiedEmail) return null;
  const member = await db
    .collection("workspaceMembers")
    .doc(workspaceMemberId(workspaceId, viewer.verifiedEmail))
    .get();
  return member.exists ? (member.data() as WorkspaceMember).role : null;
}

export async function readDocRole(
  db: FirestoreReader,
  doc: DocRecord,
  viewer: DocViewer,
): Promise<DocRole | null> {
  const workspaceRole = doc.workspaceId
    ? await readWorkspaceRole(db, doc.workspaceId, viewer)
    : null;
  return resolveDocRole(doc, viewer, workspaceRole);
}

// Starts from createdAt so docs saved before this field existed still have a stable value.
export function contentRevOf(doc: Pick<DocRecord, "contentUpdatedAt" | "createdAt">): number {
  return doc.contentUpdatedAt ?? doc.createdAt;
}
