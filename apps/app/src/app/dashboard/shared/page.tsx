import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { resolveDocRole } from "@offsprint/shared";
import { DocTable, type DocRow } from "@/components/docs/doc-table";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/feedback";
import { viewerFromSession } from "@/lib/access";
import { getSessionUser } from "@/lib/auth";
import { listDocsSharedWith } from "@/lib/docs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Shared with you" };

export default async function SharedWithYouPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard/shared");

  const viewer = viewerFromSession(user);
  const docs = viewer.verifiedEmail ? await listDocsSharedWith(viewer.verifiedEmail) : [];
  const rows: DocRow[] = docs.flatMap((doc) => {
    const role = resolveDocRole(doc, viewer, null);
    return role && role !== "owner"
      ? [{ slug: doc.slug, title: doc.title, type: doc.type, isPublic: doc.isPublic, updatedAt: doc.updatedAt, role }]
      : [];
  });

  return (
    <PageBody>
      <PageHeader title="Shared with you" />
      {rows.length > 0 ? (
        <DocTable docs={rows} />
      ) : viewer.verifiedEmail ? (
        <EmptyState title="Nothing shared with you yet">
          Docs people share with {user.email} show up here.
        </EmptyState>
      ) : (
        <EmptyState title="Your email isn't confirmed">
          Your sign-in provider didn&apos;t confirm {user.email}, so docs shared with it can&apos;t
          be opened from this account.
        </EmptyState>
      )}
    </PageBody>
  );
}
