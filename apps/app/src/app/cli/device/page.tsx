import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/logo";
import { getSessionUser } from "@/lib/auth";
import { DeviceApprovalForm } from "./approval-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Connect the CLI" };

export default async function CliDevicePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const user = await getSessionUser();
  const { code } = await searchParams;
  if (!user) {
    const next = `/cli/device${code ? `?code=${encodeURIComponent(code)}` : ""}`;
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas p-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Wordmark size="lg" />
        </div>
        <div className="mt-6 rounded-panel border border-line bg-surface p-6">
          <h1 className="text-[18px] font-semibold tracking-[-0.01em] text-ink">Connect the CLI</h1>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
            Check that this code matches the one in your terminal. The CLI can then upload and change
            docs as {user.email}.
          </p>
          <div className="mt-5">
            <DeviceApprovalForm initialCode={code ?? ""} />
          </div>
        </div>
        <p className="mt-4 text-center text-[13px] leading-relaxed text-ink-2">
          Access lasts 90 days. Run{" "}
          <code className="rounded bg-hover px-1.5 py-0.5 font-mono text-[12px]">outpost logout</code> to
          remove it from your computer.
        </p>
      </div>
    </main>
  );
}
