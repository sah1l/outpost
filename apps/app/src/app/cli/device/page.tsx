import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { SiteHeader, PageShell } from "@/components/chrome/site-header";
import { DeviceApprovalForm } from "./approval-form";

export const dynamic = "force-dynamic";

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
    <>
      <SiteHeader
        actions={
          <Link href="/dashboard" className="btn-ghost">
            Dashboard
          </Link>
        }
      />
      <PageShell width="default">
        <div className="mx-auto max-w-lg">
          <div className="smallcaps mb-3">CLI device authorization</div>
          <h1 className="font-display text-5xl font-light leading-[0.95] tracking-tight text-[var(--ink)]">
            Connect your CLI.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-[var(--ink-2)]">
            Enter the code shown in your terminal to grant the CLI access to your
            account. You can revoke this token at any time from your dashboard.
          </p>
          <div className="rule-dashed my-8" />
          <DeviceApprovalForm initialCode={code ?? ""} email={user.email} />
        </div>
      </PageShell>
    </>
  );
}
