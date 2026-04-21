import { redirect } from "next/navigation";
import Link from "next/link";
import { env } from "@/env";
import { getSessionUser } from "@/lib/auth";
import { getDoc } from "@/lib/docs";
import { SiteHeader, PageShell } from "@/components/chrome/site-header";

export const dynamic = "force-dynamic";

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);

  if (!doc) {
    return (
      <>
        <SiteHeader />
        <PageShell width="narrow">
          <div className="text-center">
            <div className="smallcaps mb-3">Folio · missing</div>
            <h1 className="font-display text-5xl text-[var(--ink)]">Not found.</h1>
            <p className="mt-4 text-[14px] text-[var(--ink-2)]">
              This share doesn&apos;t exist.
            </p>
            <div className="mt-6 font-mono text-[11px] text-[var(--ink-3)]">
              /s/{slug}
            </div>
          </div>
        </PageShell>
      </>
    );
  }

  if (doc.isPublic) {
    redirect(`${env.usercontentBaseUrl()}/view/${slug}`);
  }

  const user = await getSessionUser();
  if (user && user.uid === doc.ownerId) {
    return (
      <>
        <SiteHeader user={user} />
        <PageShell width="narrow">
          <div className="smallcaps mb-3">Private</div>
          <h1 className="font-display text-5xl text-[var(--ink)]">Not public.</h1>
          <p className="mt-4 text-[14px] text-[var(--ink-2)]">
            This share is private. Toggle it public from your{" "}
            <Link
              href="/dashboard"
              className="text-[var(--accent)] underline underline-offset-4"
            >
              dashboard
            </Link>{" "}
            or the editor.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/editor/${slug}`} className="btn-accent">
              Open in editor →
            </Link>
            <Link href="/dashboard" className="btn-ghost">
              Dashboard
            </Link>
          </div>
        </PageShell>
      </>
    );
  }

  return (
    <>
      <SiteHeader user={user} />
      <PageShell width="narrow">
        <div className="text-center">
          <div className="smallcaps mb-3">Folio · unavailable</div>
          <h1 className="font-display text-5xl text-[var(--ink)]">Not available.</h1>
          <p className="mt-4 text-[14px] text-[var(--ink-2)]">
            This share isn&apos;t public.
          </p>
        </div>
      </PageShell>
    </>
  );
}
