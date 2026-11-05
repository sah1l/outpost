import { CircleAlert } from "lucide-react";
import type { ReactNode } from "react";

export function Banner({
  children,
  action,
  className = "",
}: {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-control bg-danger-tint px-3 py-2.5 text-[13px] leading-relaxed text-danger ${className}`}
    >
      <CircleAlert size={15} className="mt-[3px] shrink-0" aria-hidden="true" />
      <div className="min-w-0 flex-1">{children}</div>
      {action}
    </div>
  );
}

export function EmptyState({
  title,
  children,
  actions,
}: {
  title: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="rounded-panel border border-dashed border-line-strong px-6 py-14 text-center">
      <h2 className="text-[16px] font-semibold text-ink">{title}</h2>
      {children && (
        <div className="mx-auto mt-1.5 max-w-md text-[14px] leading-relaxed text-ink-2">{children}</div>
      )}
      {actions && <div className="mt-5 flex flex-wrap items-center justify-center gap-2">{actions}</div>}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1 basis-64">
        <h1 className="break-words text-[22px] font-semibold leading-tight tracking-[-0.015em] text-ink">
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-[14px] text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function PageBody({ children, width = "default" }: { children: ReactNode; width?: "default" | "narrow" }) {
  return (
    <main
      className={`mx-auto w-full px-4 py-6 sm:px-8 sm:py-8 ${width === "narrow" ? "max-w-2xl" : "max-w-5xl"}`}
    >
      {children}
    </main>
  );
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-hover font-semibold text-ink-2"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.39) }}
    >
      {initialsFor(name)}
    </span>
  );
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean);
  if (!parts.length) return "?";
  const first = parts[0]?.[0] ?? "";
  const second = parts[1]?.[0] ?? "";
  return (first + second).toUpperCase();
}
