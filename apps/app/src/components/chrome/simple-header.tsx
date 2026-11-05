import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";

// For pages outside the signed-in app: home, upload without an account, sign-in.
export function SimpleHeader({
  actions,
  width = "default",
}: {
  actions?: ReactNode;
  // Match the page below it, so the logo and the content share a left edge.
  width?: "default" | "narrow";
}) {
  return (
    <header
      className={`mx-auto flex h-16 w-full items-center justify-between gap-4 px-4 sm:px-8 ${
        width === "narrow" ? "max-w-2xl" : "max-w-5xl"
      }`}
    >
      <Link href="/" aria-label="Outpost home" className="flex rounded-control">
        <Wordmark />
      </Link>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
