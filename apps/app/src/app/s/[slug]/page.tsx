import type { Metadata } from "next";
import { ArrowLeft, PenLine } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { canEditDoc, CONTENT_SANDBOX_FLAGS, verifiedEmailOf } from "@offsprint/shared";
import { SignOutButton } from "@/components/app/sign-out-button";
import { SimpleHeader } from "@/components/chrome/simple-header";
import { AccessLabel, DocTypeIcon, RoleLabel } from "@/components/docs/doc-labels";
import { ShareButton } from "@/components/share/share-button";
import { buttonClass } from "@/components/ui/button";
import { PageBody } from "@/components/ui/feedback";
import { docRoleFor, privateViewUrl, publicViewUrl, viewerFromSession } from "@/lib/access";
import { getSessionUser, syncUserIdentity, type SessionUser } from "@/lib/auth";
import { getDoc } from "@/lib/docs";

export const dynamic = "force-dynamic";
// A doc's title stays out of the tab until access is checked below, so a link can't reveal it.
export const metadata: Metadata = { title: "Doc" };

export default async function SharePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = await getDoc(slug);
  if (doc?.isPublic) redirect(publicViewUrl(doc));

  // A missing doc takes the same path as a private one, so a link can't be
  // used to find out whether a doc exists.
  const user = await getSessionUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/s/${slug}`)}`);

  const role = doc ? await docRoleFor(doc, viewerFromSession(user)) : null;
  if (!doc || !role) return <NoAccess user={user} />;

  // usercontent reads the viewer's email from their user record when it checks the token.
  await syncUserIdentity(user);
  const src = await privateViewUrl(doc, user.uid);

  return (
    <div className="flex h-dvh min-h-0 flex-col bg-surface">
      <header className="flex shrink-0 items-center gap-2 border-b border-line px-2 py-2 sm:px-3">
        <Link
          href="/dashboard"
          aria-label="Back to your docs"
          title="Back to your docs"
          className={buttonClass({ variant: "ghost", size: "sm", icon: true, className: "shrink-0" })}
        >
          <ArrowLeft size={16} aria-hidden="true" />
        </Link>
        <DocTypeIcon type={doc.type} size={17} />
        <h1 className="min-w-0 truncate text-[14px] font-medium text-ink" title={doc.title}>
          {doc.title}
        </h1>
        <span className="hidden shrink-0 pl-1.5 sm:inline-flex">
          {role === "owner" ? (
            <AccessLabel isPublic={doc.isPublic} shareCount={doc.shares?.length ?? 0} />
          ) : (
            <RoleLabel role={role} />
          )}
        </span>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {canEditDoc(role) && doc.type !== "zip" && (
            <Link href={`/editor/${doc.slug}`} className={buttonClass({ size: "sm" })}>
              <PenLine size={14} aria-hidden="true" />
              Edit
            </Link>
          )}
          {role === "owner" && (
            <ShareButton slug={doc.slug} title={doc.title} isPublic={doc.isPublic} />
          )}
        </div>
      </header>
      <iframe
        title={doc.title}
        src={src}
        sandbox={CONTENT_SANDBOX_FLAGS}
        referrerPolicy="no-referrer"
        className="min-h-0 w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}

function NoAccess({ user }: { user: SessionUser }) {
  const unverified = verifiedEmailOf(user) === null;
  return (
    <div className="min-h-dvh bg-surface">
      <SimpleHeader width="narrow" />
      <PageBody width="narrow">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">
          You can&apos;t open this doc
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          It doesn&apos;t exist, or it hasn&apos;t been shared with {user.email}. If someone shared it
          with a different address, sign in with that one.
        </p>
        {unverified && (
          <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
            Your sign-in provider didn&apos;t confirm this address, so docs shared with it can&apos;t be
            opened from this account.
          </p>
        )}
        <div className="mt-6 flex flex-wrap gap-2">
          <Link href="/dashboard" className={buttonClass({ variant: "primary" })}>
            Go to your docs
          </Link>
          <SignOutButton />
        </div>
      </PageBody>
    </div>
  );
}
