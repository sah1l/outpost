import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, FileUp } from "lucide-react";
import { DocTable, type DocRow } from "@/components/docs/doc-table";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageBody, PageHeader } from "@/components/ui/feedback";
import { getSessionUser, syncUserIdentity } from "@/lib/auth";
import { listUserDocs } from "@/lib/docs";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your docs" };

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");

  // The CLI reads the viewer's email from their user record, and it may predate this field.
  await syncUserIdentity(user);

  const docs = await listUserDocs(user.uid);
  const rows: DocRow[] = docs.map((doc) => ({
    slug: doc.slug,
    title: doc.title,
    type: doc.type,
    isPublic: doc.isPublic,
    updatedAt: doc.updatedAt,
    role: "owner",
    sizeBytes: doc.sizeBytes,
    shareCount: doc.shares?.length ?? 0,
  }));

  return (
    <PageBody>
      <PageHeader title="Your docs" />
      {rows.length === 0 ? (
        <EmptyState
          title="No docs yet"
          actions={
            <>
              <Link href="/editor/new?type=md" className={buttonClass({ variant: "primary" })}>
                <FileText size={15} aria-hidden="true" />
                New Markdown doc
              </Link>
              <Link href="/upload" className={buttonClass()}>
                <FileUp size={15} aria-hidden="true" />
                Upload a file
              </Link>
            </>
          }
        >
          Write something, upload a file, or publish with{" "}
          <code className="whitespace-nowrap rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">
            outpost upload
          </code>
          .
        </EmptyState>
      ) : (
        <DocTable docs={rows} showSize />
      )}
    </PageBody>
  );
}
