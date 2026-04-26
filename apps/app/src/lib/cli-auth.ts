import { NextResponse } from "next/server";
import { verifyCliToken, type CliTokenRecord } from "./cli-tokens";

export interface CliPrincipal {
  uid: string;
  email: string;
  token: CliTokenRecord;
}

export class CliAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliAuthError";
  }
}

function extractBearer(req: Request): string | null {
  const h = req.headers.get("authorization");
  if (!h) return null;
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1]!.trim() : null;
}

export async function requireCliUser(req: Request): Promise<CliPrincipal> {
  const token = extractBearer(req);
  if (!token) throw new CliAuthError("missing bearer token");
  const rec = await verifyCliToken(token);
  if (!rec) throw new CliAuthError("invalid or expired token");
  return { uid: rec.uid, email: rec.email ?? "", token: rec };
}

export function cliAuthErrorResponse(e: unknown): NextResponse | null {
  if (e instanceof CliAuthError) {
    return NextResponse.json({ error: e.message }, { status: 401 });
  }
  return null;
}
