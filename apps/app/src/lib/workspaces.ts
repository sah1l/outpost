import type { WriteBatch } from "firebase-admin/firestore";
import { nanoid } from "nanoid";
import {
  readWorkspaceRole,
  workspaceMemberId,
  type DocViewer,
  type ShareRole,
  type WorkspaceMember,
  type WorkspaceRecord,
  type WorkspaceRole,
} from "@offsprint/shared";
import { adminFirestore } from "./firebase-admin";

const WORKSPACES = "workspaces";
// Top level rather than a subcollection so a person's workspaces can be listed
// from the email without a collection-group index.
const MEMBERS = "workspaceMembers";

// Firestore allows 500 writes per batch.
const BATCH_SIZE = 400;

function db() {
  return adminFirestore();
}

export async function createWorkspace(
  name: string,
  owner: { uid: string; email: string },
): Promise<WorkspaceRecord> {
  const now = Date.now();
  const record: WorkspaceRecord = {
    id: nanoid(12),
    name,
    ownerId: owner.uid,
    ownerEmail: owner.email,
    createdAt: now,
    updatedAt: now,
  };
  await db().collection(WORKSPACES).doc(record.id).create(record);
  return record;
}

export async function getWorkspace(id: string): Promise<WorkspaceRecord | null> {
  const snap = await db().collection(WORKSPACES).doc(id).get();
  return snap.exists ? (snap.data() as WorkspaceRecord) : null;
}

export function workspaceRoleFor(
  workspaceId: string,
  viewer: DocViewer,
): Promise<WorkspaceRole | null> {
  return readWorkspaceRole(db(), workspaceId, viewer);
}

export async function renameWorkspace(id: string, name: string): Promise<void> {
  await db().collection(WORKSPACES).doc(id).set({ name, updatedAt: Date.now() }, { merge: true });
}

export interface WorkspaceWithRole {
  workspace: WorkspaceRecord;
  role: WorkspaceRole;
}

export async function listWorkspacesFor(viewer: DocViewer): Promise<WorkspaceWithRole[]> {
  const owned = await db().collection(WORKSPACES).where("ownerId", "==", viewer.uid).get();
  const results: WorkspaceWithRole[] = owned.docs.map((d) => ({
    workspace: d.data() as WorkspaceRecord,
    role: "owner",
  }));

  if (viewer.verifiedEmail) {
    const memberships = await db()
      .collection(MEMBERS)
      .where("email", "==", viewer.verifiedEmail)
      .get();
    const rows = memberships.docs.map((d) => d.data() as WorkspaceMember);
    if (rows.length > 0) {
      const snaps = await db().getAll(
        ...rows.map((m) => db().collection(WORKSPACES).doc(m.workspaceId)),
      );
      snaps.forEach((snap, i) => {
        const row = rows[i];
        if (snap.exists && row) {
          results.push({ workspace: snap.data() as WorkspaceRecord, role: row.role });
        }
      });
    }
  }
  return results.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
}

export async function listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const snap = await db().collection(MEMBERS).where("workspaceId", "==", workspaceId).get();
  return snap.docs
    .map((d) => d.data() as WorkspaceMember)
    .sort((a, b) => a.email.localeCompare(b.email));
}

export async function setMember(
  workspaceId: string,
  email: string,
  role: ShareRole,
  addedBy: string,
): Promise<WorkspaceMember> {
  const member: WorkspaceMember = { workspaceId, email, role, addedBy, addedAt: Date.now() };
  await db().collection(MEMBERS).doc(workspaceMemberId(workspaceId, email)).set(member);
  return member;
}

export async function removeMember(workspaceId: string, email: string): Promise<void> {
  await db().collection(MEMBERS).doc(workspaceMemberId(workspaceId, email)).delete();
}

// The docs survive with their owners and simply leave the workspace.
export async function deleteWorkspace(id: string): Promise<void> {
  const firestore = db();
  const docs = await firestore.collection("docs").where("workspaceId", "==", id).get();
  const members = await firestore.collection(MEMBERS).where("workspaceId", "==", id).get();

  const writes = [
    ...docs.docs.map((d) => (b: WriteBatch) => b.set(d.ref, { workspaceId: null }, { merge: true })),
    ...members.docs.map((d) => (b: WriteBatch) => b.delete(d.ref)),
  ];
  for (let i = 0; i < writes.length; i += BATCH_SIZE) {
    const batch = firestore.batch();
    for (const write of writes.slice(i, i + BATCH_SIZE)) write(batch);
    await batch.commit();
  }
  await firestore.collection(WORKSPACES).doc(id).delete();
}
