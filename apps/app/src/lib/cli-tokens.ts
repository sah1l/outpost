import { randomBytes, createHash } from "node:crypto";
import { adminFirestore } from "./firebase-admin";

const DEVICE_CODES = "cliDeviceCodes";
const TOKENS = "cliTokens";

export const DEVICE_CODE_TTL_MS = 15 * 60 * 1000;
export const DEVICE_POLL_INTERVAL_S = 5;
export const TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const LAST_USED_REFRESH_MS = 60 * 60 * 1000;

export interface DeviceCodeRecord {
  deviceCode: string; // hashed
  userCode: string; // user-typed, e.g. ABCD-1234
  status: "pending" | "approved" | "denied";
  uid: string | null;
  createdAt: number;
  expiresAt: number;
  consumedAt: number | null;
}

export interface CliTokenRecord {
  tokenHash: string;
  uid: string;
  email: string;
  label: string;
  createdAt: number;
  lastUsedAt: number;
  expiresAt: number;
}

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

const USER_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I,O,0,1
function randomUserCode(): string {
  const buf = randomBytes(8);
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += USER_CODE_ALPHABET[buf[i]! % USER_CODE_ALPHABET.length];
    if (i === 3) out += "-";
  }
  return out;
}

export async function createDeviceCode(): Promise<{ deviceCode: string; userCode: string; record: DeviceCodeRecord }> {
  const deviceCode = randomToken(32);
  const userCode = randomUserCode();
  const now = Date.now();
  // Doc ID is the hashed deviceCode so CLI polls are point reads. The userCode
  // (typed by the human) is stored as a field; the approval page resolves it
  // via a where("userCode", "==", ...) query, which only the human approval
  // path takes — once per login, not per poll.
  const record: DeviceCodeRecord = {
    deviceCode: sha256(deviceCode),
    userCode,
    status: "pending",
    uid: null,
    createdAt: now,
    expiresAt: now + DEVICE_CODE_TTL_MS,
    consumedAt: null,
  };
  await adminFirestore().collection(DEVICE_CODES).doc(record.deviceCode).create(record);
  return { deviceCode, userCode, record };
}

async function findByUserCode(userCode: string) {
  const q = await adminFirestore()
    .collection(DEVICE_CODES)
    .where("userCode", "==", userCode.toUpperCase())
    .limit(1)
    .get();
  if (q.empty) return null;
  return q.docs[0]!;
}

export async function getDeviceByUserCode(userCode: string): Promise<DeviceCodeRecord | null> {
  const doc = await findByUserCode(userCode);
  return doc ? (doc.data() as DeviceCodeRecord) : null;
}

export async function approveDeviceCode(userCode: string, uid: string): Promise<DeviceCodeRecord | null> {
  const doc = await findByUserCode(userCode);
  if (!doc) return null;
  const ref = doc.ref;
  return adminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return null;
    const rec = snap.data() as DeviceCodeRecord;
    if (rec.status !== "pending" || rec.expiresAt < Date.now()) return null;
    tx.set(ref, { status: "approved", uid }, { merge: true });
    return { ...rec, status: "approved", uid };
  });
}

export async function denyDeviceCode(userCode: string): Promise<void> {
  const doc = await findByUserCode(userCode);
  if (!doc) return;
  await adminFirestore().runTransaction(async (tx) => {
    const snap = await tx.get(doc.ref);
    if (!snap.exists) return;
    const rec = snap.data() as DeviceCodeRecord;
    if (rec.status !== "pending") return;
    tx.set(doc.ref, { status: "denied" }, { merge: true });
  });
}

export async function pollDeviceCode(deviceCode: string): Promise<DeviceCodeRecord | null> {
  const hash = sha256(deviceCode);
  const snap = await adminFirestore().collection(DEVICE_CODES).doc(hash).get();
  if (!snap.exists) return null;
  return snap.data() as DeviceCodeRecord;
}

export async function consumeDeviceCode(deviceCode: string): Promise<void> {
  await adminFirestore()
    .collection(DEVICE_CODES)
    .doc(sha256(deviceCode))
    .set({ consumedAt: Date.now() }, { merge: true });
}

export async function issueCliToken(uid: string, email: string, label = "cli"): Promise<string> {
  const token = randomToken(32);
  const now = Date.now();
  const record: CliTokenRecord = {
    tokenHash: sha256(token),
    uid,
    email,
    label,
    createdAt: now,
    lastUsedAt: now,
    expiresAt: now + TOKEN_TTL_MS,
  };
  await adminFirestore().collection(TOKENS).doc(record.tokenHash).create(record);
  return token;
}

export async function verifyCliToken(token: string): Promise<CliTokenRecord | null> {
  if (!token) return null;
  const hash = sha256(token);
  const snap = await adminFirestore().collection(TOKENS).doc(hash).get();
  if (!snap.exists) return null;
  const rec = snap.data() as CliTokenRecord;
  if (rec.expiresAt < Date.now()) return null;
  // Throttle lastUsedAt updates — one write per request would amplify Firestore
  // load on a chatty CLI.
  const now = Date.now();
  if (now - (rec.lastUsedAt ?? 0) > LAST_USED_REFRESH_MS) {
    void snap.ref.set({ lastUsedAt: now }, { merge: true });
  }
  return rec;
}

export async function revokeCliToken(token: string): Promise<void> {
  const hash = sha256(token);
  await adminFirestore().collection(TOKENS).doc(hash).delete();
}
