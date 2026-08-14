import type { BrandProfile, TemplateFamily } from "./types";

// Design presets pair a template family with distinct palette/type/voice so two
// brands in the same vertical are visibly and tonally different by construction.
export interface DesignPreset {
  id: string;
  label: string;
  templateFamily: TemplateFamily;
  tone: string;
  voiceAdjectives: string[];
  ctaStyle: string;
  palette: BrandProfile["palette"];
  typography: BrandProfile["typography"];
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    id: "aurora-warm",
    label: "Aurora — warm & friendly",
    templateFamily: "aurora",
    tone: "warm, reassuring",
    voiceAdjectives: ["friendly", "meticulous", "dependable", "neighborly"],
    ctaStyle: "Get my free quote",
    palette: { bg: "#fbf7f2", surface: "#ffffff", text: "#2a2320", primary: "#c9532d", accent: "#f0a24b" },
    typography: { heading: "'Georgia', 'Times New Roman', serif", body: "'Helvetica Neue', Arial, sans-serif" },
  },
  {
    id: "meridian-bold",
    label: "Meridian — bold & industrial",
    templateFamily: "meridian",
    tone: "confident, direct",
    voiceAdjectives: ["precise", "code-compliant", "no-nonsense", "battle-tested"],
    ctaStyle: "Request inspection",
    palette: { bg: "#0f1720", surface: "#16212e", text: "#0f1720", primary: "#2f9e6b", accent: "#f2c744" },
    typography: { heading: "'Arial Black', 'Helvetica Neue', sans-serif", body: "'Inter', 'Segoe UI', sans-serif" },
  },
  {
    id: "aurora-coastal",
    label: "Aurora — calm coastal",
    templateFamily: "aurora",
    tone: "calm, professional",
    voiceAdjectives: ["clean-line", "unhurried", "transparent", "detail-driven"],
    ctaStyle: "Book a color consult",
    palette: { bg: "#f2f7f8", surface: "#ffffff", text: "#1d2b30", primary: "#2a7f9e", accent: "#5cc0c9" },
    typography: { heading: "'Palatino Linotype', Georgia, serif", body: "'Helvetica Neue', Arial, sans-serif" },
  },
  {
    id: "meridian-heritage",
    label: "Meridian — heritage red",
    templateFamily: "meridian",
    tone: "established, trustworthy",
    voiceAdjectives: ["seasoned", "thorough", "straight-talking", "warranty-backed"],
    ctaStyle: "Get my roof estimate",
    palette: { bg: "#faf6f4", surface: "#f1e7e3", text: "#241512", primary: "#a5342a", accent: "#d98a4b" },
    typography: { heading: "'Arial Black', Impact, sans-serif", body: "'Georgia', serif" },
  },
];
