import { FieldValue } from "firebase-admin/firestore";
import { ANON_DAILY_UPLOAD_LIMIT_PER_IP } from "@offsprint/shared";
import { adminFirestore } from "./firebase-admin";

function dayKey(now = Date.now()): string {
  return new Date(now).toISOString().slice(0, 10);
}

function safeIpKey(ip: string): string {
  return ip.replace(/[^a-zA-Z0-9._:-]/g, "_").slice(0, 64);
}

export async function checkAndIncrementAnonUploadQuota(ip: string): Promise<{ ok: true } | { ok: false; remaining: 0 }> {
  const db = adminFirestore();
  const today = dayKey();
  const docId = `${today}_${safeIpKey(ip)}`;
  const ref = db.collection("anonQuotas").doc(docId);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const count = (snap.data()?.count as number | undefined) ?? 0;
    if (count >= ANON_DAILY_UPLOAD_LIMIT_PER_IP) {
      return { ok: false, remaining: 0 } as const;
    }
    tx.set(
      ref,
      {
        count: FieldValue.increment(1),
        day: today,
        ip: safeIpKey(ip),
        expiresAt: Date.now() + 48 * 60 * 60 * 1000,
      },
      { merge: true },
    );
    return { ok: true } as const;
  });
}

export function extractClientIp(req: Request): string {
  const hdrs = req.headers;
  const cfip = hdrs.get("cf-connecting-ip");
  if (cfip) return cfip;
  const fwd = hdrs.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = hdrs.get("x-real-ip");
  if (real) return real;
  return "unknown";
}
