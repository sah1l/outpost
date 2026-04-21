import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { listUserDocs } from "@/lib/docs";
import { adminFirestore } from "@/lib/firebase-admin";
import { SiteHeader, PageShell, Breadcrumb } from "@/components/chrome/site-header";
import { LogoutButton } from "./logout-button";
import { DocList } from "./doc-list";

export const dynamic = "force-dynamic";

const QUOTA_BYTES = 200 * 1024 * 1024;

async function getStorageUsed(uid: string): Promise<number> {
  const snap = await adminFirestore().collection("users").doc(uid).get();
  return Number(snap.data()?.storageUsedBytes ?? 0);
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <>
        <SiteHeader />
        <PageShell width="narrow">
          <div className="smallcaps mb-3">Session</div>
          <h1 className="font-display text-4xl text-[var(--ink)]">
            You&apos;ve been signed out.
          </h1>
          <p className="mt-3 text-[14px] text-[var(--ink-2)]">
            The session expired.{" "}
            <Link
              href="/login"
              className="text-[var(--accent)] underline underline-offset-4"
            >
              Sign in again
            </Link>
            .
          </p>
        </PageShell>
      </>
    );
  }

  const [docs, used] = await Promise.all([
    listUserDocs(user.uid),
    getStorageUsed(user.uid),
  ]);
  const pct = Math.min(100, (used / QUOTA_BYTES) * 100);

  return (
    <>
      <SiteHeader
        user={user}
        breadcrumb={<Breadcrumb items={[{ label: "dashboard" }]} />}
        actions={
          <>
            <Link href="/upload" className="btn-accent">
              + Upload
            </Link>
            <LogoutButton />
          </>
        }
      />
      <PageShell width="wide">
        <div className="reveal reveal-1 mb-10 grid gap-6 md:grid-cols-12 md:items-end">
          <div className="md:col-span-7">
            <div className="smallcaps mb-3 flex items-center gap-3">
              <span>No. 02 — Library</span>
              <span className="h-px w-12 bg-[var(--ink)]" />
              <span>{docs.length} {docs.length === 1 ? "entry" : "entries"}</span>
            </div>
            <h1 className="font-display text-[clamp(2.5rem,6vw,4.5rem)] font-light leading-[0.95] tracking-[-0.02em] text-[var(--ink)]">
              Your shares.
            </h1>
            <p className="mt-3 font-mono text-[12px] text-[var(--ink-3)]">
              {user.email}
            </p>
          </div>
          <div className="md:col-span-5">
            <StorageCard used={used} quota={QUOTA_BYTES} pct={pct} format={formatSize} />
          </div>
        </div>

        <div className="reveal reveal-2">
          {docs.length === 0 ? (
            <EmptyState />
          ) : (
            <DocList initialDocs={docs} />
          )}
        </div>
      </PageShell>
    </>
  );
}

function StorageCard({
  used,
  quota,
  pct,
  format,
}: {
  used: number;
  quota: number;
  pct: number;
  format: (b: number) => string;
}) {
  return (
    <div className="relative border border-[var(--ink)] bg-[var(--paper)] p-5">
      <div className="smallcaps flex items-center justify-between">
        <span>Storage</span>
        <span className="font-mono text-[11px] tracking-normal text-[var(--ink-3)]">
          {pct.toFixed(1)}%
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2 font-display">
        <span className="text-3xl text-[var(--ink)]">{format(used)}</span>
        <span className="text-sm text-[var(--ink-3)]">/ {format(quota)}</span>
      </div>
      <div className="mt-4 h-1 w-full bg-[var(--paper-3)]">
        <div
          className="h-full accent-sweep bg-[var(--accent)]"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      <div className="mt-3 flex items-center justify-between font-mono text-[10px] text-[var(--ink-4)]">
        <span>0</span>
        <span>{format(quota / 2)}</span>
        <span>{format(quota)}</span>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="relative border border-dashed border-[var(--ink)] bg-[var(--paper)] p-12 text-center">
      <div className="smallcaps text-[var(--ink-3)]">— Empty —</div>
      <p className="mt-4 font-display text-3xl text-[var(--ink)]">
        Nothing shared yet.
      </p>
      <p className="mt-2 text-[14px] text-[var(--ink-3)]">
        Upload your first file. It&apos;ll appear here.
      </p>
      <Link href="/upload" className="btn-accent mt-6">
        + Upload
      </Link>
    </div>
  );
}
