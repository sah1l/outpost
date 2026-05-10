import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { getDoc } from "@/lib/docs";
import { SiteHeader, PageShell, Breadcrumb } from "@/components/chrome/site-header";
import { EditorShell } from "./editor-shell";

export const dynamic = "force-dynamic";

export default async function EditorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const user = await getSessionUser();
  if (!user) notFound();

  const doc = await getDoc(slug);
  if (!doc || doc.ownerId !== user.uid) notFound();

  if (doc.type === "zip") {
    return (
      <>
        <SiteHeader
          user={user}
          breadcrumb={
            <Breadcrumb
              items={[
                { label: "dashboard", href: "/dashboard" },
                { label: slug },
              ]}
            />
          }
          actions={
            <Link href="/dashboard" className="btn-ghost">
              Back
            </Link>
          }
        />
        <PageShell width="narrow">
          <div className="smallcaps mb-3">Status · unavailable</div>
          <h1 className="font-display text-4xl text-[var(--ink)]">
            Not editable.
          </h1>
          <p className="mt-4 text-[14px] leading-relaxed text-[var(--ink-2)]">
            ZIP uploads are served as a site — they can&apos;t be edited inline.
            Re-upload the changed files if you need to update them.
          </p>
          <Link href="/dashboard" className="btn-ghost mt-8">
            ← Back to dashboard
          </Link>
        </PageShell>
      </>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col">
      <SiteHeader
        user={user}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: "dashboard", href: "/dashboard" },
              { label: doc.slug },
            ]}
          />
        }
      />
      <EditorShell
        slug={doc.slug}
        docType={doc.type}
        title={doc.title}
        initialIsPublic={doc.isPublic}
      />
    </div>
  );
}
