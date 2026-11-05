// An O with its outpost: a ring, and one dot standing off on its own.
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18.39 11.7A7.5 7.5 0 1 1 12.3 5.61"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="18" cy="6" r="2.5" fill="var(--link)" />
    </svg>
  );
}

export function Wordmark({ size = "md" }: { size?: "md" | "lg" }) {
  const large = size === "lg";
  return (
    <span className="inline-flex items-center gap-1.5 text-ink">
      <LogoMark size={large ? 28 : 22} />
      <span
        className={`font-semibold tracking-[-0.015em] ${large ? "text-[20px]" : "text-[15px]"}`}
        style={{ fontStretch: "110%" }}
      >
        Outpost
      </span>
    </span>
  );
}
