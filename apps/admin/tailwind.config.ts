import type { Config } from "tailwindcss";

// Continue Leads — light enterprise design system.
// Token NAMES are kept stable (ink/dim/faint/canvas/surface/line/amber/data/…) so the
// whole app re-themes from here; VALUES are the light palette.
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#F5F6F8",   // page background
        surface: "#FFFFFF",  // cards
        raised: "#F1F3F6",   // subtle hover / inset
        line: "#E4E7EC",     // borders
        "line-soft": "#EFF1F4",
        ink: "#101828",      // primary text
        dim: "#475467",      // secondary text
        faint: "#8A94A6",    // muted text
        primary: { DEFAULT: "#4F46E5", dark: "#4338CA", ink: "#FFFFFF" }, // indigo action
        amber: "#D97706",    // brand accent + money highlights
        data: "#175CD3",     // links / data blue
        ok: "#12B76A",
        warn: "#F79009",
        bad: "#F04438",
        info: "#2E90FA",
        violet: "#7A5AF8",
        // back-compat aliases
        accent: "#4F46E5",   // links now indigo
        panel: "#FFFFFF",
      },
      fontFamily: {
        display: ["var(--font-display)", "Space Grotesk", "Inter", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      borderRadius: { sm: "6px", DEFAULT: "10px", lg: "12px", xl: "16px" },
      boxShadow: {
        xs: "0 1px 2px rgba(16,24,40,0.05)",
        sm: "0 1px 3px rgba(16,24,40,0.10), 0 1px 2px rgba(16,24,40,0.06)",
        card: "0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)",
        lg: "0 8px 24px rgba(16,24,40,0.08)",
        pop: "0 12px 32px rgba(16,24,40,0.12)",
      },
    },
  },
  plugins: [],
} satisfies Config;
