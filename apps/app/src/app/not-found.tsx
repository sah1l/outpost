import Link from "next/link";
import { SimpleHeader } from "@/components/chrome/simple-header";
import { buttonClass } from "@/components/ui/button";
import { PageBody } from "@/components/ui/feedback";

export default function NotFound() {
  return (
    <div className="min-h-dvh bg-surface">
      <SimpleHeader width="narrow" />
      <PageBody width="narrow">
        <h1 className="text-[22px] font-semibold tracking-[-0.015em] text-ink">Page not found</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-2">
          This page doesn&apos;t exist, or you don&apos;t have access to it. Check the link, or ask the
          person who sent it.
        </p>
        <Link href="/" className={buttonClass({ variant: "primary", className: "mt-6" })}>
          Go to Outpost
        </Link>
      </PageBody>
    </div>
  );
}
