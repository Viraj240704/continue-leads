import "server-only";
import type { Client } from "./db";
import type { BrandProfile } from "./types";
import { buildPostPath, initialPostTitles, type BlogConfig, DEFAULT_BLOG } from "./blog";
import { generatePages } from "./jobs";

export async function getBlogConfig(c: Client, brandId: string): Promise<BlogConfig> {
  const r = (await c.query(`SELECT blog_config FROM brands WHERE id = $1`, [brandId])).rows[0];
  return { ...DEFAULT_BLOG, ...(r?.blog_config ?? {}) };
}

// Enable/save a blog on an EXISTING site: persist config, create any missing blog
// pages (index + launch posts) and generate them.
export async function saveBlogForBrand(
  c: Client, tenantId: string, brandId: string, config: BlogConfig, actorUserId: string
): Promise<{ ok: boolean; created: number; generated: number }> {
  await c.query(`UPDATE brands SET blog_config = $2 WHERE id = $1`, [brandId, JSON.stringify(config)]);
  if (!config.enabled) return { ok: true, created: 0, generated: 0 };

  const brand = (await c.query(`SELECT profile FROM brands WHERE id = $1`, [brandId])).rows[0];
  const profile = brand.profile as BrandProfile;
  const city = profile.cities?.[0] ?? profile.addressCity;
  const prefix = config.urlPrefix || "/blog";

  // Existing paths so we never duplicate.
  const existing = new Set<string>(
    (await c.query(`SELECT path FROM site_pages WHERE brand_id = $1`, [brandId])).rows.map((r) => r.path)
  );

  const items: { pageType: string; path: string; title: string; context: any; priority: number }[] = [];
  if (!existing.has(prefix)) items.push({ pageType: "BLOG_INDEX", path: prefix, title: "Blog", context: {}, priority: 90 });

  const titles = initialPostTitles(config.topics ?? [], profile.services ?? [], city, config.initialPosts ?? 0);
  let pr = 91;
  for (const title of titles) {
    const path = buildPostPath(config.postPattern, prefix, title);
    if (!existing.has(path)) items.push({ pageType: "BLOG_POST", path, title, context: { city }, priority: pr++ });
  }

  const newIds: string[] = [];
  for (const it of items) {
    const r = await c.query(
      `INSERT INTO site_pages (tenant_id, brand_id, page_type, path, title, context, priority)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [tenantId, brandId, it.pageType, it.path, it.title, it.context, it.priority]
    );
    newIds.push(r.rows[0].id);
  }

  let generated = 0;
  if (newIds.length) {
    await generatePages(c, { tenantId, brandId, actorUserId, pageIds: newIds });
    generated = newIds.length;
  }
  return { ok: true, created: items.length, generated };
}
