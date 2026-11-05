import { NextResponse } from "next/server";
import { MAX_WORKSPACE_NAME_LENGTH } from "@offsprint/shared";
import { viewerFromSession } from "@/lib/access";
import { sessionOr401 } from "@/lib/auth";
import { createWorkspace, listWorkspacesFor } from "@/lib/workspaces";

export const runtime = "nodejs";

export async function GET() {
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ workspaces: await listWorkspacesFor(viewerFromSession(user)) });
}

export async function POST(req: Request) {
  const user = await sessionOr401();
  if (user instanceof NextResponse) return user;

  const body = (await req.json().catch(() => null)) as { name?: string } | null;
  const name = (body?.name ?? "").trim().slice(0, MAX_WORKSPACE_NAME_LENGTH);
  if (!name) return NextResponse.json({ error: "name is required" }, { status: 400 });

  const workspace = await createWorkspace(name, { uid: user.uid, email: user.email });
  return NextResponse.json({ workspace }, { status: 201 });
}
