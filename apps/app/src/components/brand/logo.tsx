import type { SVGProps } from "react";

export function LogoMark({
  size = 22,
  accent = "var(--accent)",
  ink = "currentColor",
  ...rest
}: {
  size?: number;
  accent?: string;
  ink?: string;
} & Omit<SVGProps<SVGSVGElement>, "width" | "height">) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      {...rest}
    >
      {/* Left chevron */}
      <path
        d="M10 7 L3 16 L10 25"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* Right chevron */}
      <path
        d="M22 7 L29 16 L22 25"
        stroke={ink}
        strokeWidth="2"
        strokeLinecap="square"
        strokeLinejoin="miter"
        fill="none"
      />
      {/* Diamond core */}
      <path d="M16 10 L21 16 L16 22 L11 16 Z" fill={accent} />
      {/* Cut through diamond for texture */}
      <path
        d="M11 16 L21 16"
        stroke={ink}
        strokeWidth="1"
        opacity="0.85"
      />
    </svg>
  );
}

export function Wordmark({
  size = "md",
  showMark = true,
}: {
  size?: "sm" | "md" | "lg" | "xl" | "hero";
  showMark?: boolean;
}) {
  const sizes = {
    sm: { mark: 18, text: "text-[15px]", gap: "gap-2" },
    md: { mark: 22, text: "text-[18px]", gap: "gap-2.5" },
    lg: { mark: 32, text: "text-[26px]", gap: "gap-3" },
    xl: { mark: 48, text: "text-[40px]", gap: "gap-4" },
    hero: { mark: 72, text: "text-[64px]", gap: "gap-5" },
  } as const;
  const s = sizes[size];
  return (
    <span className={`inline-flex items-center ${s.gap}`}>
      {showMark && <LogoMark size={s.mark} />}
      <span
        className={`font-display ${s.text} font-medium leading-none tracking-[-0.01em]`}
      >
        share
        <span
          className="mx-[0.15em] inline-block align-middle h-[0.08em] min-h-[2px] w-[0.4em] bg-[var(--accent)]"
          aria-hidden="true"
        />
        html
      </span>
    </span>
  );
}
