import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, PageShell } from "@/components/chrome/site-header";
import { LogoMark } from "@/components/brand/logo";
import { LoginButton } from "./login-button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const { next } = await searchParams;
  if (user) redirect(next || "/dashboard");

  return (
    <>
      <SiteHeader
        actions={
          <Link href="/" className="btn-ghost">
            Back
          </Link>
        }
      />
      <PageShell width="default">
        <div className="mx-auto max-w-lg text-center sm:text-left">
          <div className="reveal reveal-1 mb-8 flex justify-center sm:justify-start">
            <div className="relative">
              <LogoMark size={88} />
              <span className="absolute -right-3 -top-3 h-3 w-3 border border-[var(--ink)] bg-[var(--paper)]" />
              <span className="absolute -bottom-3 -left-3 h-3 w-3 border border-[var(--ink)] bg-[var(--paper)]" />
            </div>
          </div>

          <div className="reveal reveal-2 smallcaps mb-3 flex items-center justify-center gap-3 sm:justify-start">
            <span>Enter</span>
            <span className="h-px w-8 bg-[var(--ink)]" />
            <span>Google or Microsoft</span>
          </div>

          <h1 className="reveal reveal-3 font-display text-6xl font-light leading-[0.95] tracking-tight text-[var(--ink)]">
            Welcome back.
          </h1>

          <p className="reveal reveal-3 mt-5 text-[15px] leading-relaxed text-[var(--ink-2)]">
            <span className="font-mono text-[13px] text-[var(--ink)]">
              share-html
            </span>{" "}
            uses Google or Microsoft for authentication. No password, no
            profile — we keep a record of your email and storage usage only.
          </p>

          <div className="reveal reveal-4 mt-8 flex justify-center sm:justify-start">
            <LoginButton redirectTo={next || "/dashboard"} />
          </div>

          <div className="rule-dashed mt-12" />

          <p className="reveal reveal-5 mt-6 text-[13px] text-[var(--ink-3)]">
            Don&apos;t want to sign in?{" "}
            <Link
              href="/upload"
              className="text-[var(--accent)] underline underline-offset-4"
            >
              Upload anonymously
            </Link>{" "}
            — 2 MB, kept 14 days.
          </p>
        </div>
      </PageShell>
    </>
  );
}
