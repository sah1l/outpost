import Link from "next/link";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/brand/logo";

export function SiteHeader({
  user,
  breadcrumb,
  actions,
  variant = "default",
}: {
  user?: { email: string; displayName: string | null } | null;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
  variant?: "default" | "slim";
}) {
  return (
    <header
      className="relative z-10 border-b border-[var(--ink)] bg-[var(--paper)]/80 backdrop-blur-[2px]"
      data-variant={variant}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link
          href={user ? "/dashboard" : "/"}
          className="group flex items-center text-[var(--ink)] hover:text-[var(--accent)] transition-colors"
          aria-label="share-html home"
        >
          <Wordmark size="md" />
        </Link>

        {breadcrumb ? (
          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            <Divider />
            <div className="min-w-0 flex-1 truncate text-[13px] text-[var(--ink-2)]">
              {breadcrumb}
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-2">
          {actions}
          {user ? <UserChip user={user} /> : null}
        </div>
      </div>
      <div className="absolute bottom-[-1px] left-0 right-0 h-px">
        <div className="mx-auto h-px max-w-6xl bg-[var(--ink)]/20" />
      </div>
    </header>
  );
}

function Divider() {
  return (
    <span className="text-[var(--ink-4)] font-display text-base leading-none select-none">
      ·
    </span>
  );
}

function UserChip({ user }: { user: { email: string; displayName: string | null } }) {
  const initials = initialsFor(user.displayName || user.email);
  return (
    <div
      title={user.email}
      className="flex h-8 w-8 items-center justify-center border border-[var(--ink)] bg-[var(--paper-2)] text-[10px] font-semibold tracking-widest text-[var(--ink)]"
    >
      {initials}
    </div>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return "·";
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? parts[0]?.[1] ?? "";
  return (first + second).toUpperCase().slice(0, 2);
}

export function PageShell({
  children,
  width = "default",
}: {
  children: ReactNode;
  width?: "default" | "wide" | "narrow" | "full";
}) {
  const max =
    width === "wide"
      ? "max-w-6xl"
      : width === "narrow"
        ? "max-w-xl"
        : width === "full"
          ? "max-w-none"
          : "max-w-4xl";
  return (
    <main className={`relative z-[1] mx-auto px-4 py-10 sm:px-6 sm:py-14 ${max}`}>
      {children}
    </main>
  );
}

export function Breadcrumb({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav className="flex items-center gap-2 font-mono text-[12px]">
      {items.map((item, i) => {
        const isLast = i === items.length - 1;
        return (
          <span key={i} className="flex items-center gap-2">
            {item.href && !isLast ? (
              <Link
                href={item.href}
                className="text-[var(--ink-3)] hover:text-[var(--accent)] transition-colors"
              >
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-[var(--ink)]" : "text-[var(--ink-3)]"}>
                {item.label}
              </span>
            )}
            {!isLast && (
              <span className="text-[var(--ink-4)]" aria-hidden="true">
                /
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
