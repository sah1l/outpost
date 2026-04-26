import { NextResponse } from "next/server";
import type { CliDeviceTokenSuccess } from "@offsprint/shared";
import {
  pollDeviceCode,
  consumeDeviceCode,
  issueCliToken,
} from "@/lib/cli-tokens";
import { adminFirestore } from "@/lib/firebase-admin";

export const runtime = "nodejs";

interface TokenBody {
  deviceCode?: string;
}

function err(error: string, status = 400) {
  return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as TokenBody | null;
  const deviceCode = body?.deviceCode;
  if (typeof deviceCode !== "string" || deviceCode.length < 32) {
    return err("invalid_request", 400);
  }

  const rec = await pollDeviceCode(deviceCode);
  if (!rec) return err("invalid_request", 400);
  if (rec.expiresAt < Date.now()) return err("expired_token", 400);
  if (rec.consumedAt) return err("expired_token", 400);

  if (rec.status === "pending") return err("authorization_pending", 400);
  if (rec.status === "denied") return err("denied", 400);

  if (!rec.uid) return err("invalid_request", 400);
  const userSnap = await adminFirestore().collection("users").doc(rec.uid).get();
  const email = (userSnap.data()?.email as string | undefined) ?? "";

  const [token] = await Promise.all([
    issueCliToken(rec.uid, email, "cli"),
    consumeDeviceCode(deviceCode),
  ]);

  const out: CliDeviceTokenSuccess = {
    accessToken: token,
    tokenType: "Bearer",
    user: { uid: rec.uid, email },
  };
  return NextResponse.json(out);
}
