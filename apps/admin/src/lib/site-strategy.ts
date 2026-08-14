// Client-safe site-type + URL-strategy constants and the money-page path builder.

export type SiteType = "micro" | "local" | "regional" | "franchise" | "national";

// Named starter templates (keyed by design-preset id). Real names, not colour combos.
// These stand in until the Figma-ZIP importer populates the library.
export const TEMPLATE_CATALOG: Record<string, { name: string; blurb: string }> = {
  "aurora-warm": { name: "Homestead", blurb: "Warm, trust-first layout for residential home services" },
  "meridian-bold": { name: "Vanguard", blurb: "Bold, high-contrast layout for competitive markets" },
  "aurora-coastal": { name: "Tidewater", blurb: "Airy, spacious feel with generous whitespace" },
  "meridian-heritage": { name: "Cornerstone", blurb: "Classic, established look for legacy brands" },
};
export function templateName(presetId: string): string {
  return TEMPLATE_CATALOG[presetId]?.name ?? presetId.replace(/-/g, " ");
}

export const SITE_TYPES: { value: SiteType; label: string; scale: string }[] = [
  { value: "micro", label: "Micro", scale: "Single neighborhood" },
  { value: "local", label: "Local", scale: "Local provider" },
  { value: "regional", label: "Regional", scale: "Regional company" },
  { value: "franchise", label: "Franchise", scale: "Multi-location" },
  { value: "national", label: "National", scale: "Nationwide brand" },
];

// Money-page URL presets. {service} and {city} are the required tokens.
export const URL_PRESETS: { pattern: string; label: string }[] = [
  { pattern: "/services/{service}/{city}", label: "/services/{service}/{city}" },
  { pattern: "/{service}-{city}", label: "/{service}-{city}" },
  { pattern: "/{city}/{service}", label: "/{city}/{service}" },
  { pattern: "/locations/{city}/{service}", label: "/locations/{city}/{service}" },
];

const slug = (s: string) => s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Build a concrete money-page path from a pattern + service/city.
export function buildMoneyPath(pattern: string, service: string, city: string): string {
  let p = (pattern || "/services/{service}/{city}")
    .replace(/\{service\}/g, slug(service))
    .replace(/\{city\}/g, slug(city));
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/{2,}/g, "/");
}

// Validate a custom pattern: must contain both tokens, lowercase, url-safe.
export function validatePattern(pattern: string): string | null {
  if (!pattern.includes("{service}")) return "Pattern must include {service}.";
  if (!pattern.includes("{city}")) return "Pattern must include {city}.";
  const stripped = pattern.replace(/\{service\}|\{city\}/g, "");
  if (!/^[a-z0-9/\-]*$/.test(stripped)) return "Only lowercase letters, numbers, / and - are allowed.";
  return null;
}

export function previewUrl(domain: string, pattern: string): string {
  const host = (domain || "yoursite.com").replace(/^https?:\/\//, "").replace(/\/$/, "");
  return host + buildMoneyPath(pattern, "roof-repair", "denver");
}
