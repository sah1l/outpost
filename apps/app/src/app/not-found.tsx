import Link from "next/link";
import { SiteHeader, PageShell } from "@/components/chrome/site-header";

export default function NotFound() {
  return (
    <>
      <SiteHeader />
      <PageShell width="narrow">
        <div className="text-center">
          <div className="smallcaps mb-3">Folio · missing</div>
          <div className="font-display text-[clamp(6rem,18vw,12rem)] leading-[0.9] tracking-[-0.04em] text-[var(--ink)]">
            4<span className="italic text-[var(--accent)]">0</span>4
          </div>
          <p className="mt-4 text-[15px] text-[var(--ink-2)]">
            This page doesn&apos;t exist — or never did.
          </p>
          <Link href="/" className="btn-ghost mt-8">
            ← Back home
          </Link>
        </div>
      </PageShell>
    </>
  );
}
