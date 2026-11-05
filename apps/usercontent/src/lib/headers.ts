import { CONTENT_SANDBOX_FLAGS, type DocRecord } from "@offsprint/shared";
import { env } from "@/env";

// Browsers revalidate every time, and shared caches like the Cloudflare edge can hold a copy for
// 60 seconds. So making a public doc private can leave a stale copy at the edge for up to a minute.
const PUBLIC_VIEW_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";

// Bump when what we serve for an unchanged doc changes, like the injected shim or the Markdown
// stylesheet. Otherwise browsers holding an older copy keep getting a 304 for it.
const SERVE_VERSION = "2";

// updatedAt changes on every write through updateDoc, including visibility flips. The subpath tells
// a zip's files apart, and is encoded because a header can't hold a name like "日本語.css".
export function publicViewHeaders(doc: DocRecord, subpath: string | null): Record<string, string> {
  const sub = subpath ? `-${encodeURIComponent(subpath)}` : "";
  return {
    "Cache-Control": PUBLIC_VIEW_CACHE_CONTROL,
    ETag: `W/"v${SERVE_VERSION}-${doc.slug}-${doc.updatedAt}-${doc.isPublic ? 1 : 0}${sub}"`,
  };
}

// On every response, not just HTML, so an SVG or extra page opened directly is sandboxed too.
// Files carry Access-Control-Allow-Origin: * because a sandboxed page's own fetch(), module
// scripts and web fonts count as cross-origin. That exposes nothing new: * never applies to
// credentialed requests, and a private doc's files are only reachable under its token.
export function securityHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const appOrigin = env.appBaseUrl();
  return {
    "Content-Security-Policy":
      `sandbox ${CONTENT_SANDBOX_FLAGS}; ` +
      "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: https:; " +
      `frame-ancestors 'self' ${appOrigin}`,
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Access-Control-Allow-Origin": "*",
    ...extra,
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
