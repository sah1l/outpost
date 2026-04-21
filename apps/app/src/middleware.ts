import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@offsprint/shared";

export const config = {
  matcher: ["/dashboard/:path*", "/editor/:path*"],
};

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!cookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
