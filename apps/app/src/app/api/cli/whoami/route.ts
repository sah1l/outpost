import { NextResponse } from "next/server";
import { requireCliUser, cliAuthErrorResponse } from "@/lib/cli-auth";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const principal = await requireCliUser(req);
    return NextResponse.json({
      uid: principal.uid,
      email: principal.email,
      tokenCreatedAt: principal.token.createdAt,
      tokenExpiresAt: principal.token.expiresAt,
    });
  } catch (e) {
    const authResponse = cliAuthErrorResponse(e);
    if (authResponse) return authResponse;
    throw e;
  }
}
