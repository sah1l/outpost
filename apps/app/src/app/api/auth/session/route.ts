import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@offsprint/shared";
import { adminAuth } from "@/lib/firebase-admin";
import { SESSION_MAX_AGE_MS, upsertUserRecord } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const { idToken } = (await req.json().catch(() => ({}))) as { idToken?: string };
  if (!idToken) {
    return NextResponse.json({ error: "missing idToken" }, { status: 400 });
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken, true);
  } catch {
    return NextResponse.json({ error: "invalid token" }, { status: 401 });
  }

  const sessionCookie = await adminAuth().createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });

  await upsertUserRecord({
    uid: decoded.uid,
    email: decoded.email ?? "",
    displayName: (decoded.name as string | undefined) ?? null,
    photoURL: (decoded.picture as string | undefined) ?? null,
  });

  const jar = await cookies();
  jar.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    maxAge: Math.floor(SESSION_MAX_AGE_MS / 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        // Belt-and-suspenders: Fastly fronts Firebase Hosting and may strip
        // Set-Cookie on cacheable responses. Force private/no-store so the CDN
        // passes the cookie through untouched.
        "cache-control": "private, no-store, max-age=0",
      },
    },
  );
}
