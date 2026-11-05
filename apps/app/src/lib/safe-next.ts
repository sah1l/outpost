const PROBE_ORIGIN = "https://probe.invalid";

// Where to go after signing in, limited to paths on this site, so a link to our login page can't
// send someone elsewhere. Parsed rather than pattern-matched: browsers treat "/\evil.com" and
// "/<tab>/evil.com" as "//evil.com", and the URL parser applies the same rules they do.
export function safeNextPath(next: string | undefined, fallback = "/dashboard"): string {
  if (!next?.startsWith("/")) return fallback;
  try {
    const url = new URL(next, PROBE_ORIGIN);
    return url.origin === PROBE_ORIGIN ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
