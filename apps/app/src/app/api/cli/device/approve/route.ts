import { NextResponse } from "next/server";
import { requireUser, AuthError } from "@/lib/auth";
import { approveDeviceCode, denyDeviceCode, getDeviceByUserCode } from "@/lib/cli-tokens";

export const runtime = "nodejs";

interface Body {
  userCode?: string;
  action?: "approve" | "deny";
}

const USER_CODE_RE = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    throw e;
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const userCode = body?.userCode?.trim().toUpperCase() ?? "";
  if (!USER_CODE_RE.test(userCode)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const rec = await getDeviceByUserCode(userCode);
  if (!rec) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (rec.expiresAt < Date.now()) return NextResponse.json({ error: "expired" }, { status: 410 });
  if (rec.status !== "pending") return NextResponse.json({ error: "already_resolved" }, { status: 409 });

  if (body?.action === "deny") {
    await denyDeviceCode(userCode);
    return NextResponse.json({ ok: true, status: "denied" });
  }
  await approveDeviceCode(userCode, user.uid);
  return NextResponse.json({ ok: true, status: "approved" });
}
