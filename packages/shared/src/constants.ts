export const MAX_UPLOAD_BYTES_ANON = 2 * 1024 * 1024;
export const MAX_UPLOAD_BYTES_USER = 10 * 1024 * 1024;

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

export const SESSION_COOKIE_NAME = "offsprint_session";
export const ANON_SESSION_COOKIE_NAME = "offsprint_anon";
