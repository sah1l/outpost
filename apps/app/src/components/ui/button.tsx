import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

// Written out in full: Tailwind only keeps classes it can find as whole words in the source.
const VARIANT_CLASSES: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

// A function as well as a component, so a Next <Link> can look like a button.
export function buttonClass({
  variant = "secondary",
  size = "md",
  icon = false,
  className = "",
}: { variant?: Variant; size?: Size; icon?: boolean; className?: string } = {}): string {
  return ["btn", VARIANT_CLASSES[variant], size === "sm" && "btn-sm", icon && "btn-icon", className]
    .filter(Boolean)
    .join(" ");
}

export function Button({
  variant,
  size,
  icon,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  // Square, for a lone icon. Give it an aria-label.
  icon?: boolean;
}) {
  return (
    <button type={type} className={buttonClass({ variant, size, icon, className })} {...props} />
  );
}
