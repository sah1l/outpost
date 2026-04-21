import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, PageShell, Breadcrumb } from "@/components/chrome/site-header";
import { UploadForm } from "./upload-form";

export default async function UploadPage() {
  const user = await getSessionUser();
  return (
    <>
      <SiteHeader
        user={user}
        breadcrumb={
          <Breadcrumb
            items={[
              { label: user ? "dashboard" : "home", href: user ? "/dashboard" : "/" },
              { label: "upload" },
            ]}
          />
        }
        actions={
          user ? (
            <Link href="/dashboard" className="btn-ghost">
              Cancel
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )
        }
      />
      <PageShell width="default">
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="reveal reveal-1 smallcaps mb-4">§ Upload</div>
            <h1 className="reveal reveal-2 font-display text-5xl font-light leading-[0.95] tracking-tight text-[var(--ink)] md:text-6xl">
              Hand us a file.
            </h1>
            <p className="reveal reveal-3 mt-6 max-w-sm text-[14px] leading-relaxed text-[var(--ink-2)]">
              {user
                ? "Single HTML or Markdown up to 10 MB. ZIPs get unpacked. You'll land straight in the editor."
                : "Up to 2 MB, kept for 14 days. Sign in for 10 MB, private by default, and full editing."}
            </p>
            <div className="reveal reveal-4 mt-8 space-y-3 text-[12px]">
              <MetaRow
                label="Quota"
                value={user ? "10 MB / upload" : "2 MB / upload"}
              />
              <MetaRow label="Accepted" value=".html · .md · .zip" />
              <MetaRow label="Lifetime" value={user ? "unlimited" : "14 days"} />
              <MetaRow
                label="Visibility"
                value={user ? "private by default" : "choose on upload"}
              />
            </div>
          </div>

          <div className="reveal reveal-3 md:col-span-7">
            <UploadForm loggedIn={Boolean(user)} />
          </div>
        </div>
      </PageShell>
    </>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-[var(--ink)]/20 pb-2">
      <span className="smallcaps w-20 shrink-0">{label}</span>
      <span className="font-mono text-[12px] text-[var(--ink)]">{value}</span>
    </div>
  );
}
