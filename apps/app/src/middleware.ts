import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@offsprint/shared";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/editor/:path*",
    "/cli/:path*",
    "/workspaces/:path*",
    "/api/:path*",
  ],
};

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Called by the CLI before it has a token. They read no cookie, so there's nothing to forge.
const COOKIELESS_WRITES = new Set(["/api/cli/device", "/api/cli/device/token"]);

// The session cookie is SameSite=Lax, which doesn't stop a page on a sibling host: a form on
// usercontent counts as same-site, so the browser sends the cookie along with its POST. So every
// cookie-authenticated write has to prove it came from this app.
function isFromThisApp(req: NextRequest): boolean {
  // Sec-Fetch-Site is set by the browser and pages can't change it. "same-site" is exactly the
  // sibling-host case, so it must not pass. "none" is the person's own action, like a reload.
  const site = req.headers.get("sec-fetch-site");
  if (site) return site === "same-origin" || site === "none";

  // Older browsers. With neither header the request is refused, because browsers always
  // send at least one of them on these methods.
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(process.env.APP_BASE_URL ?? "").origin;
  } catch {
    return false;
  }
}

function guardApiWrite(req: NextRequest): NextResponse {
  const allowed =
    !WRITE_METHODS.has(req.method) ||
    COOKIELESS_WRITES.has(req.nextUrl.pathname) ||
    // A page can't attach this header across origins without a CORS preflight, which the app
    // never allows, so a bearer token is proof enough. This is how the CLI authenticates.
    /^bearer\s/i.test(req.headers.get("authorization") ?? "") ||
    isFromThisApp(req);

  return allowed
    ? NextResponse.next()
    : NextResponse.json({ error: "cross-site request blocked" }, { status: 403 });
}

export function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) return guardApiWrite(req);

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    // Keeps the query too: the CLI's approval link carries its code in ?code=.
    url.searchParams.set("next", req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
