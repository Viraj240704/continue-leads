// Client-safe blog config + helpers (no server-only imports).

export type Cadence = "weekly" | "biweekly" | "monthly";

export interface BlogConfig {
  enabled: boolean;
  cadence: Cadence;
  postsPerRun: number;   // posts generated each cadence cycle
  initialPosts: number;  // posts generated at launch
  urlPrefix: string;     // e.g. /blog
  postPattern: string;   // e.g. /blog/{slug}
  topics: string[];      // topic focus areas
}

export const CADENCES: { value: Cadence; label: string; perMonth: number }[] = [
  { value: "weekly", label: "Weekly", perMonth: 4 },
  { value: "biweekly", label: "Every 2 weeks", perMonth: 2 },
  { value: "monthly", label: "Monthly", perMonth: 1 },
];

export const DEFAULT_BLOG: BlogConfig = {
  enabled: false,
  cadence: "weekly",
  postsPerRun: 1,
  initialPosts: 4,
  urlPrefix: "/blog",
  postPattern: "/blog/{slug}",
  topics: [],
};

export const slugifyBlog = (s: string) =>
  s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function buildPostPath(pattern: string, prefix: string, slug: string): string {
  let p = (pattern || "/blog/{slug}").replace(/\{slug\}/g, slugifyBlog(slug));
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/{2,}/g, "/");
}

// Turn topic focus areas (+ services fallback) into launch post titles.
export function initialPostTitles(topics: string[], services: string[], city: string, n: number): string[] {
  const base = topics.length ? topics : services.map((s) => s.replace(/-/g, " "));
  const templates = [
    (t: string) => `How much does ${t} cost in ${city}?`,
    (t: string) => `${cap(t)} in ${city}: what to expect`,
    (t: string) => `5 signs you need ${t}`,
    (t: string) => `Choosing a ${t} pro in ${city}`,
    (t: string) => `${cap(t)}: a homeowner's guide`,
  ];
  const out: string[] = [];
  let i = 0;
  while (out.length < n && base.length) {
    const t = base[out.length % base.length]!;
    out.push(templates[i % templates.length]!(t));
    i++;
    if (i > n * templates.length) break;
  }
  return out.slice(0, n);
}

function cap(s: string) { return s.charAt(0).toUpperCase() + s.slice(1); }

export function validateBlog(b: BlogConfig): string | null {
  if (!b.enabled) return null;
  if (!b.urlPrefix.startsWith("/")) return "URL prefix must start with /.";
  if (!b.postPattern.includes("{slug}")) return "Post pattern must include {slug}.";
  if (b.initialPosts < 0 || b.initialPosts > 50) return "Initial posts must be 0–50.";
  return null;
}
