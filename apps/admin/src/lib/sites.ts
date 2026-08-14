import "server-only";
import type { Client } from "./db";
import type { BrandProfile, TemplateFamily } from "./types";
import { generatePagePlan } from "./pageplan";
import { getPack } from "./packs";
import { audit } from "./audit";
import { DESIGN_PRESETS } from "./presets";

export interface BrandRow {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  vertical_pack_id: string;
  template_family: TemplateFamily;
  domain: string;
  profile: BrandProfile;
  status: string;
  brief: string;
  logo_asset_id: string | null;
  domain_status: string;
}

export interface CreateBrandInput {
  name: string;
  slug: string;
  domain: string;
  verticalPackId: string;
  templateFamily?: TemplateFamily; // optional — assigned internally when omitted
  templatePresetId?: string;       // operator-chosen template (preset id); overrides family
  siteType?: string;               // micro | local | regional | franchise | national
  urlPattern?: string;             // money-page URL pattern, e.g. /services/{service}/{city}
  blogConfig?: any;                // BlogConfig — enable/cadence/url/topics
  profile: BrandProfile;
  brief?: string;
  domainStatus?: "provided" | "purchased" | "pending";
  rollout: {
    launchSize: number;
    weeklyTargets: number[];
    dailyCap: number;
    timezone: string;
  };
}

async function ensureUniqueBrandSlug(c: Client, tenantId: string, requestedSlug: string) {
  const baseSlug = requestedSlug.trim();
  if (!baseSlug) throw new Error("Brand slug is required");

  const { rows } = await c.query(
    `SELECT slug FROM brands WHERE tenant_id = $1 AND (slug = $2 OR slug LIKE $3)`,
    [tenantId, baseSlug, `${baseSlug}-%`]
  );

  const existing = new Set(rows.map((row) => String(row.slug)));
  if (!existing.has(baseSlug)) return baseSlug;

  let suffix = 2;
  while (existing.has(`${baseSlug}-${suffix}`)) suffix += 1;
  return `${baseSlug}-${suffix}`;
}

export async function createBrandWithPlan(
  c: Client,
  tenantId: string,
  actorUserId: string,
  input: CreateBrandInput
): Promise<string> {
  const pack = await getPack(c, input.verticalPackId);
  if (!pack) throw new Error("Vertical pack not found");

  // Assign the design internally: rotate through presets by existing brand count so
  // two brands in the same tenant/vertical get materially different looks by default.
  const { rows: [{ n: brandCount }] } = await c.query(`SELECT count(*)::int AS n FROM brands WHERE tenant_id = $1`, [tenantId]);
  const rotated = DESIGN_PRESETS[Number(brandCount) % DESIGN_PRESETS.length]!;
  const preset = input.templatePresetId
    ? (DESIGN_PRESETS.find((x) => x.id === input.templatePresetId) ?? rotated)
    : input.templateFamily
      ? (DESIGN_PRESETS.find((x) => x.templateFamily === input.templateFamily) ?? rotated)
      : rotated;
  const templateFamily = preset.templateFamily;
  const profile: BrandProfile = {
    ...input.profile,
    tone: preset.tone,
    voiceAdjectives: preset.voiceAdjectives,
    ctaStyle: preset.ctaStyle,
    palette: preset.palette,
    typography: preset.typography,
  };

  const urlPattern = input.urlPattern || "/services/{service}/{city}";
  const blogConfig = input.blogConfig ?? { enabled: false };
  const uniqueSlug = await ensureUniqueBrandSlug(c, tenantId, input.slug);
  const brand = await c.query(
    `INSERT INTO brands (tenant_id, name, slug, vertical_pack_id, template_family, domain, profile, status, brief, domain_status, site_type, url_pattern, blog_config)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,$9,$10,$11,$12) RETURNING id`,
    [tenantId, input.name, uniqueSlug, input.verticalPackId, templateFamily, input.domain, profile,
     input.brief ?? "", input.domainStatus ?? "provided", input.siteType ?? "local", urlPattern, JSON.stringify(blogConfig)]
  );
  const brandId = brand.rows[0].id as string;

  await c.query(
    `INSERT INTO site_rollout_policies (tenant_id, brand_id, launch_size, weekly_targets, daily_cap, timezone)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, brandId, input.rollout.launchSize, JSON.stringify(input.rollout.weeklyTargets), input.rollout.dailyCap, input.rollout.timezone]
  );

  // Page plan
  const plan = generatePagePlan(pack.config, profile, urlPattern, blogConfig);
  const pathToId = new Map<string, string>();
  for (const item of plan) {
    const r = await c.query(
      `INSERT INTO site_pages (tenant_id, brand_id, page_type, path, title, context, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [tenantId, brandId, item.pageType, item.path, item.title, item.context, item.priority]
    );
    pathToId.set(item.path, r.rows[0].id);
  }
  // Resolve dependencies path -> id
  for (const item of plan) {
    const deps = item.dependsOnPaths.map((p) => pathToId.get(p)).filter(Boolean) as string[];
    if (deps.length) {
      await c.query(`UPDATE site_pages SET depends_on = $1 WHERE id = $2`, [deps, pathToId.get(item.path)]);
    }
  }

  await audit(c, { tenantId, brandId, eventType: "brand_created", actorUserId, detail: { pages: plan.length, pack: pack.key } });
  await audit(c, { tenantId, brandId, eventType: "plan_created", actorUserId, detail: { pages: plan.length } });
  return brandId;
}

export async function getBrand(c: Client, brandId: string): Promise<BrandRow | null> {
  const { rows } = await c.query(`SELECT * FROM brands WHERE id = $1`, [brandId]);
  return (rows[0] as BrandRow) ?? null;
}

export async function listBrands(c: Client) {
  const { rows } = await c.query(
    `SELECT b.*, vp.name AS pack_name,
        (SELECT count(*) FROM site_pages sp WHERE sp.brand_id = b.id) AS page_count,
        (SELECT count(*) FROM site_pages sp WHERE sp.brand_id = b.id AND sp.deployment_state = 'published') AS published_count,
        (SELECT count(*) FROM site_pages sp WHERE sp.brand_id = b.id AND sp.indexing_state = 'indexable') AS indexable_count
     FROM brands b JOIN vertical_packs vp ON vp.id = b.vertical_pack_id
     ORDER BY b.created_at DESC`
  );
  return rows;
}

export async function listPages(c: Client, brandId: string) {
  const { rows } = await c.query(
    `SELECT sp.*,
        (SELECT status FROM qa_runs qr WHERE qr.page_version_id = sp.current_version_id ORDER BY qr.created_at DESC LIMIT 1) AS qa_status,
        (SELECT decision FROM approvals a WHERE a.page_version_id = sp.current_version_id ORDER BY a.created_at DESC LIMIT 1) AS approval
     FROM site_pages sp WHERE sp.brand_id = $1
     ORDER BY sp.priority, sp.path`,
    [brandId]
  );
  return rows;
}

export async function getPage(c: Client, pageId: string) {
  const { rows } = await c.query(`SELECT * FROM site_pages WHERE id = $1`, [pageId]);
  return rows[0] ?? null;
}
