// Signed viewing links for private docs. The app checks the viewer's session, then
// sends the sandboxed frame to usercontent with one of these in the path. usercontent
// never reads a cookie: the token says who is asking, and access is rechecked on every
// request, so removing someone locks them out without waiting for the token to expire.
//
// A token is bound to one doc, so a page can't use its own token to open another doc.
// Web Crypto, not node:crypto, because this package also reaches browser bundles.

const SIGNING_CONTEXT = "outpost-content-v1";

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function signedMessage(uid: string, slug: string, expiresAtSeconds: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(
    `${SIGNING_CONTEXT}|${uid}|${slug}|${expiresAtSeconds}`,
  ) as Uint8Array<ArrayBuffer>;
}

export async function signContentToken(
  secret: string,
  claims: { uid: string; slug: string; expiresAt: number },
): Promise<string> {
  const expiresAtSeconds = Math.floor(claims.expiresAt / 1000).toString(36);
  const mac = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    signedMessage(claims.uid, claims.slug, expiresAtSeconds),
  );
  const uidPart = toBase64Url(new TextEncoder().encode(claims.uid));
  return `${uidPart}.${expiresAtSeconds}.${toBase64Url(new Uint8Array(mac))}`;
}

// Returns the uid the token was issued to, or null if it is forged, expired or for another doc.
export async function verifyContentToken(
  secret: string,
  token: string,
  slug: string,
  now: number = Date.now(),
): Promise<string | null> {
  const [uidPart, expiresAtSeconds, macPart, ...rest] = token.split(".");
  if (!uidPart || !expiresAtSeconds || !macPart || rest.length > 0) return null;
  if (!/^[0-9a-z]+$/.test(expiresAtSeconds)) return null;
  if (parseInt(expiresAtSeconds, 36) * 1000 <= now) return null;

  const uidBytes = fromBase64Url(uidPart);
  const mac = fromBase64Url(macPart);
  if (!uidBytes || !mac) return null;
  const uid = new TextDecoder().decode(uidBytes);

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    mac,
    signedMessage(uid, slug, expiresAtSeconds),
  );
  return valid ? uid : null;
}
