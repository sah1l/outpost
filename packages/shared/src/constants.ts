export const MAX_UPLOAD_BYTES_ANON = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES_USER = 10 * 1024 * 1024;

// Shown on the storage meter. Nothing enforces it yet.
export const STORAGE_QUOTA_BYTES = 200 * 1024 * 1024;

export const ANON_DAILY_UPLOAD_LIMIT_PER_IP = 5;
export const ANON_DOC_TTL_DAYS = 30;

export const ZIP_MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024;
export const ZIP_MAX_ENTRIES = 1000;
export const ZIP_MAX_COMPRESSION_RATIO = 100;

export const ALLOWED_ZIP_EXTENSIONS = new Set([
  ".html", ".htm", ".css", ".js", ".mjs", ".json", ".md",
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico",
  ".woff", ".woff2", ".ttf", ".otf",
  ".txt", ".map",
]);

export const SLUG_LENGTH = 10;

export const MAX_DOC_SHARES = 50;
export const MAX_WORKSPACE_MEMBERS = 100;
export const MAX_WORKSPACE_NAME_LENGTH = 80;

// How long a signed viewing link stays usable. Access is still rechecked on
// every request, so removing someone takes effect before this runs out.
export const CONTENT_TOKEN_TTL_MS = 12 * 60 * 60 * 1000;

// Sandbox flags for uploaded content. Leaving out allow-same-origin gives each
// page an opaque origin, so its scripts run but can't reach cookies, storage or
// the app. Used for the CSP header and for the viewer's iframe attribute.
export const CONTENT_SANDBOX_FLAGS =
  "allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads";

// Firebase Hosting only forwards cookies named exactly "__session" through
// its CDN rewrites to Cloud Run. Any other cookie is silently stripped both
// from Set-Cookie responses and from subsequent Cookie headers.
export const SESSION_COOKIE_NAME = "__session";
export const ANON_SESSION_COOKIE_NAME = "offsprint_anon";
