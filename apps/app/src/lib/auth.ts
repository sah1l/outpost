import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@offsprint/shared";
import { adminAuth, adminFirestore } from "./firebase-admin";

export const SESSION_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;

export interface SessionUser {
  uid: string;
  email: string;
  emailVerified: boolean;
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
      emailVerified: decoded.email_verified === true,
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

// For route handlers: `const user = await sessionOr401(); if (user instanceof NextResponse) return user;`
export async function sessionOr401(): Promise<SessionUser | NextResponse> {
  const user = await getSessionUser();
  return user ?? NextResponse.json({ error: "unauthenticated" }, { status: 401 });
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
      emailVerified: user.emailVerified,
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

// usercontent and the CLI can't see the session, so they read identity from the user record.
// Sessions last 14 days, so a record can predate a field or lag a change: top it up here.
export async function syncUserIdentity(user: SessionUser): Promise<void> {
  const ref = adminFirestore().collection("users").doc(user.uid);
  const data = (await ref.get()).data();
  if (data?.email === user.email && data?.emailVerified === user.emailVerified) return;
  await ref.set({ email: user.email, emailVerified: user.emailVerified }, { merge: true });
}
