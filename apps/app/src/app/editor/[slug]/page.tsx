import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { canEditDoc } from "@offsprint/shared";
import { AppShell } from "@/components/app/app-shell";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/feedback";
import { docRoleFor, viewerFromSession } from "@/lib/access";
import { getSessionUser } from "@/lib/auth";
import { getDoc } from "@/lib/docs";
import { EditorShell } from "./editor-shell";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Editor" };

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/editor/${slug}`)}`);

  const doc = await getDoc(slug);
  if (!doc) notFound();
  const role = await docRoleFor(doc, viewerFromSession(user));
  if (!role) notFound();
  if (!canEditDoc(role)) redirect(`/s/${slug}`);

  if (doc.type === "zip") {
    return (
      <AppShell user={user}>
        <PageBody>
          <PageHeader title={doc.title} />
          <EmptyState
            title="ZIP sites can't be edited here"
            actions={
              <>
                <Link href={`/s/${doc.slug}`} className={buttonClass({ variant: "primary" })}>
                  Open the site
                </Link>
                <Link href="/dashboard" className={buttonClass()}>
                  Back to your docs
                </Link>
              </>
            }
          >
            To change a site, edit the files on your computer and upload a new ZIP.
          </EmptyState>
        </PageBody>
      </AppShell>
    );
  }

  return (
    <EditorShell
      mode="edit"
      slug={doc.slug}
      docType={doc.type}
      title={doc.title}
      initialIsPublic={doc.isPublic}
      initialShareCount={role === "owner" ? (doc.shares?.length ?? 0) : 0}
      canManage={role === "owner"}
    />
  );
}
