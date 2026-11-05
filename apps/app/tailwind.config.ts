import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Values live in globals.css, where dark mode swaps them.
      colors: {
        canvas: "var(--canvas)",
        surface: "var(--surface)",
        raised: "var(--raised)",
        hover: "var(--hover)",
        ink: { DEFAULT: "var(--ink)", 2: "var(--ink-2)", 3: "var(--ink-3)" },
        line: { DEFAULT: "var(--line)", strong: "var(--line-strong)" },
        link: { DEFAULT: "var(--link)", hover: "var(--link-hover)", tint: "var(--link-tint)" },
        ok: { DEFAULT: "var(--ok)", tint: "var(--ok-tint)" },
        warn: { DEFAULT: "var(--warn)", tint: "var(--warn-tint)" },
        danger: { DEFAULT: "var(--danger)", tint: "var(--danger-tint)" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      borderRadius: {
        control: "6px",
        panel: "10px",
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
      },
    },
  },
  plugins: [],
};

export default config;
