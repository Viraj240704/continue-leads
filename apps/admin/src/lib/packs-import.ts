import "server-only";
import type { Client } from "./db";
import type { ParsedSheet } from "./spreadsheet";

// Standard blueprint set every product pack gets (same structure as the seeded packs).
const DEFAULT_BLUEPRINTS = [
  { type: "HOME", pathTemplate: "/", priority: 10, scope: "single", dependsOn: [] },
  { type: "CONTACT", pathTemplate: "/contact", priority: 20, scope: "single", dependsOn: ["HOME"] },
  { type: "SERVICE", pathTemplate: "/services/{service}", priority: 30, scope: "perService", dependsOn: ["HOME"] },
  { type: "CITY", pathTemplate: "/areas/{city}", priority: 40, scope: "perCity", dependsOn: ["HOME"] },
  { type: "MONEY", pathTemplate: "/services/{service}/{city}", priority: 50, scope: "perServiceCity", dependsOn: ["SERVICE", "CITY"] },
  { type: "FAQ", pathTemplate: "/faq", priority: 60, scope: "single", dependsOn: ["HOME"] },
  { type: "ABOUT", pathTemplate: "/about", priority: 70, scope: "single", dependsOn: ["HOME"] },
  { type: "PRIVACY", pathTemplate: "/privacy", priority: 80, scope: "single", legal: true, dependsOn: [] },
  { type: "TERMS", pathTemplate: "/terms", priority: 81, scope: "single", legal: true, dependsOn: [] },
  { type: "TCPA", pathTemplate: "/tcpa-disclosure", priority: 82, scope: "single", legal: true, dependsOn: [] },
];

function slug(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export interface ImportResult { products: number; services: number; packs: { key: string; name: string; services: number }[] }

// Build/replace vertical packs from an uploaded sheet.
// Expected columns: product, service_name (service, name also accepted), hint (optional).
export async function importPacks(c: Client, tenantId: string, sheet: ParsedSheet): Promise<ImportResult> {
  const h = sheet.headers;
  if (!h.includes("product")) throw new Error("template must have a 'product' column");
  const svcCol = ["service_name", "service", "name"].find((k) => h.includes(k));
  if (!svcCol) throw new Error("template must have a 'service_name' (or 'service') column");

  // Group rows by product.
  const byProduct = new Map<string, { slug: string; name: string; hint: string }[]>();
  for (const row of sheet.rows) {
    const product = row.product?.trim();
    const serviceName = row[svcCol]?.trim();
    if (!product || !serviceName) continue;
    const arr = byProduct.get(product) ?? [];
    arr.push({ slug: slug(serviceName), name: serviceName, hint: row.hint ?? "" });
    byProduct.set(product, arr);
  }
  if (byProduct.size === 0) throw new Error("no valid product/service rows found");

  const packs: ImportResult["packs"] = [];
  let totalServices = 0;
  for (const [product, services] of byProduct) {
    // Dedup services by slug.
    const uniq = Array.from(new Map(services.map((s) => [s.slug, s])).values());
    totalServices += uniq.length;
    // Tenant-prefixed key so imported packs never collide with global seeded packs.
    const key = `t${tenantId.slice(0, 8)}-${slug(product)}`;
    const config = {
      key, version: 1, name: product,
      vocabulary: { actor: "team", craft: product.toLowerCase(), unit: "project", verbs: [], materials: [], adjectives: ["reliable", "professional"] },
      services: uniq,
      pageBlueprints: DEFAULT_BLUEPRINTS,
      allowedClaims: ["Licensed and insured", "Free written estimates", "Workmanship warranty on labor"],
      prohibitedClaims: ["cheapest in {city}", "guaranteed #1 on Google"],
      requiredLocalFacts: ["service_area_cities", "years_in_business", "license_reference"],
      faq: [
        { q: "How long does a typical {service} project take?", a: "Most {service} projects in {city} are completed within a few days depending on scope." },
        { q: "Do you offer free estimates?", a: "Yes. We provide a free written estimate after an on-site walkthrough." },
      ],
      imagery: { heroThemes: ["completed project", "crew on site", "before and after", "detail work"], categories: ["completed", "crew", "detail"] },
    };
    // Tenant-scoped pack (so imports don't collide with the global seeded packs).
    await c.query(
      `INSERT INTO vertical_packs (tenant_id, key, version, name, config)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (key, version) DO UPDATE SET name = EXCLUDED.name, config = EXCLUDED.config`,
      [tenantId, key, 1, product, config]
    );
    packs.push({ key, name: product, services: uniq.length });
  }
  return { products: byProduct.size, services: totalServices, packs };
}
