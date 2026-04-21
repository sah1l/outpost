import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@offsprint/shared";
import { adminAuth, adminFirestore } from "./firebase-admin";

export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookie = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) return null;
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie, false);
    return {
      uid: decoded.uid,
      email: decoded.email ?? "",
      displayName: (decoded.name as string | undefined) ?? null,
      photoURL: (decoded.picture as string | undefined) ?? null,
    };
  } catch {
    return null;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError("unauthenticated");
  return user;
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function upsertUserRecord(user: SessionUser): Promise<void> {
  const now = Date.now();
  const ref = adminFirestore().collection("users").doc(user.uid);
  await ref.set(
    {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      photoURL: user.photoURL,
      updatedAt: now,
    },
    { merge: true },
  );
  const snap = await ref.get();
  if (!snap.data()?.createdAt) {
    await ref.set({ createdAt: now, storageUsedBytes: 0 }, { merge: true });
  }
}
