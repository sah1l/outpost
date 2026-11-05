import type { Metadata } from "next";
import { redirect } from "next/navigation";
import type { DocType } from "@offsprint/shared";
import { getSessionUser } from "@/lib/auth";
import { EditorShell } from "../[slug]/editor-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "New doc" };

export default async function NewDraftPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const docType: DocType = type === "html" ? "html" : "md";

  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/editor/new?type=${docType}`)}`);

  return <EditorShell mode="draft" docType={docType} />;
}
