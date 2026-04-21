import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, PageShell } from "@/components/chrome/site-header";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getSessionUser();
  return (
    <>
      <SiteHeader
        user={user}
        actions={
          user ? (
            <Link href="/dashboard" className="btn-ghost">
              Dashboard
            </Link>
          ) : (
            <Link href="/login" className="btn-ghost">
              Sign in
            </Link>
          )
        }
      />
      <PageShell width="wide">
        <div className="grid gap-12 md:grid-cols-12 md:gap-16">
          <section className="md:col-span-7">
            <div className="reveal reveal-1 smallcaps mb-5 flex items-center gap-3">
              <span>No. 01 — Share</span>
              <span className="h-px w-12 bg-[var(--ink)]" />
              <span>Est. {new Date().getFullYear()}</span>
            </div>
            <h1 className="reveal reveal-2 font-display text-[clamp(3rem,8vw,6.5rem)] font-light leading-[0.92] tracking-[-0.02em] text-[var(--ink)]">
              Publish
              <br />
              a <em className="italic text-[var(--accent)]">page</em>,
              <br />
              keep the key.
            </h1>

            <p className="reveal reveal-3 mt-8 max-w-md text-[15px] leading-relaxed text-[var(--ink-2)]">
              Drop an <span className="font-mono text-[13px]">.html</span>,{" "}
              <span className="font-mono text-[13px]">.md</span>, or a{" "}
              <span className="font-mono text-[13px]">.zip</span>. We mint a tidy
              link, guard the contents, and hand you an editor. Public is a
              toggle — not a commitment.
            </p>

            <div className="reveal reveal-4 mt-10 flex flex-wrap items-center gap-3">
              <Link href="/upload" className="btn-accent group">
                <span>Upload</span>
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </Link>
              {!user && (
                <Link href="/login" className="btn-ghost">
                  Or sign in for more
                </Link>
              )}
              {user && (
                <Link href="/dashboard" className="btn-ghost">
                  Your shares
                </Link>
              )}
            </div>

            <div className="reveal reveal-5 mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-[var(--ink)] pt-5">
              <Metric label="Anon limit" value="2 MB" />
              <Metric label="Signed-in" value="10 MB" />
              <Metric label="Formats" value="HTML · MD · ZIP" />
            </div>
          </section>

          <aside className="reveal reveal-3 relative md:col-span-5 md:pl-8">
            <div className="sticky top-10">
              <FrameCard />
            </div>
          </aside>
        </div>
      </PageShell>
      <Footer />
    </>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="smallcaps">{label}</div>
      <div className="mt-1 font-display text-xl text-[var(--ink)]">{value}</div>
    </div>
  );
}

function FrameCard() {
  return (
    <div className="relative">
      <div className="relative border border-[var(--ink)] bg-[var(--paper)] p-8 shadow-[6px_6px_0_0_var(--ink)]">
        <div className="smallcaps mb-6 flex items-center justify-between">
          <span>Specimen</span>
          <span className="font-mono text-[10px] tracking-normal text-[var(--ink-4)]">
            /s/quiet-finch
          </span>
        </div>
        <div className="font-display text-5xl leading-none tracking-tight text-[var(--ink)]">
          Hello,
          <br />
          <span className="italic text-[var(--accent)]">visitor</span>.
        </div>
        <div className="rule-dashed my-6" />
        <div className="space-y-2 text-[13px] leading-relaxed text-[var(--ink-2)]">
          <p>
            A single HTML file renders exactly as you wrote it. Markdown gets a
            quiet stylesheet.
          </p>
          <p className="font-mono text-[11px] text-[var(--ink-3)]">
            &lt;h1&gt;Hello, visitor&lt;/h1&gt;
          </p>
        </div>
        <div className="mt-8 flex items-center gap-2">
          <div
            className="pub-switch"
            data-on="true"
            role="presentation"
            aria-hidden="true"
          />
          <span className="smallcaps text-[var(--accent)]">Public</span>
        </div>
      </div>
      <div className="absolute -right-2 -top-2 h-3 w-3 border border-[var(--ink)] bg-[var(--paper)]" />
      <div className="absolute -left-2 -bottom-2 h-3 w-3 border border-[var(--ink)] bg-[var(--paper)]" />
    </div>
  );
}

function Footer() {
  return (
    <footer className="relative z-[1] mt-auto border-t border-[var(--ink)]/30">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-5 sm:px-6">
        <span className="smallcaps">share-html · Ed. α</span>
        <span className="font-mono text-[11px] text-[var(--ink-3)]">
          html · md · zip
        </span>
      </div>
    </footer>
  );
}
