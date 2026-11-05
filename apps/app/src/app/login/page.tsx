import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MAX_UPLOAD_BYTES_ANON } from "@offsprint/shared";
import { getSessionUser } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { Wordmark } from "@/components/brand/logo";
import { LoginButton } from "./login-button";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  const next = safeNextPath((await searchParams).next);
  if (user) redirect(next);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Link href="/" aria-label="Outpost home" className="rounded-control">
            <Wordmark size="lg" />
          </Link>
        </div>
        <div className="mt-6 rounded-panel border border-line bg-surface p-6">
          <h1 className="text-center text-[18px] font-semibold tracking-[-0.01em] text-ink">
            Sign in to Outpost
          </h1>
          <p className="mt-1 text-center text-[13px] text-ink-2">
            Use an account you already have.
          </p>
          <div className="mt-5">
            <LoginButton redirectTo={next} />
          </div>
        </div>
        <p className="mt-4 text-center text-[13px] text-ink-2">
          Just need a quick link?{" "}
          <Link href="/upload" className="text-link font-medium">
            Upload without an account
          </Link>{" "}
          (up to {MAX_UPLOAD_BYTES_ANON / 1024 / 1024} MB).
        </p>
      </div>
    </main>
  );
}
