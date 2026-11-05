import type { DocRecord } from "@offsprint/shared";
import { env } from "@/env";

// Browsers revalidate on every request (max-age=0, must-revalidate); shared
// caches (e.g. Cloudflare edge) hold the response for s-maxage seconds. With
// the ETag below, revalidations are cheap conditional GETs that return 304.
const VIEW_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";

// Never cache misses — a 404 from a private/missing doc must not pin clients
// to the missing state after the doc is flipped back to public.
export const NOT_FOUND_CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store",
};

export function securityHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const appOrigin = env.appBaseUrl();
  return {
    "Content-Security-Policy":
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; " +
      `frame-ancestors 'self' ${appOrigin}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "X-Frame-Options": "SAMEORIGIN",
    ...extra,
  };
}

// Weak ETag keyed on the parts of the doc that change what we serve. updatedAt
// changes on every write through updateDoc (including isPublic flips), so any
// state change invalidates caches. subpath is included for zip asset routes
// where the same (slug, updatedAt) covers many distinct files.
export function computeETag(doc: DocRecord, subpath = ""): string {
  const sub = subpath ? `-${subpath}` : "";
  return `W/"${doc.slug}-${doc.updatedAt}-${doc.isPublic ? 1 : 0}${sub}"`;
}

export function viewCacheHeaders(etag: string): Record<string, string> {
  return {
    "Cache-Control": VIEW_CACHE_CONTROL,
    ETag: etag,
  };
}

export function contentTypeFor(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "text/html; charset=utf-8";
  if (lower.endsWith(".css")) return "text/css; charset=utf-8";
  if (lower.endsWith(".js") || lower.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (lower.endsWith(".json")) return "application/json; charset=utf-8";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".ico")) return "image/x-icon";
  if (lower.endsWith(".woff")) return "font/woff";
  if (lower.endsWith(".woff2")) return "font/woff2";
  if (lower.endsWith(".ttf")) return "font/ttf";
  if (lower.endsWith(".otf")) return "font/otf";
  if (lower.endsWith(".md")) return "text/html; charset=utf-8";
  return "application/octet-stream";
}
