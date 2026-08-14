import "server-only";
import type { Client } from "./db";
import { getBrand } from "./sites";
import { getStorage, storageKeys } from "./adapters/storage";
import { renderPageHtml } from "./templates";
import { audit } from "./audit";
import { getLogoDataUri } from "./assets";
import { getBrandCompliance } from "./compliance";
import type { BrandProfile, GeneratedPage } from "./types";

function reconstruct(row: any): GeneratedPage {
  return { blocks: row.blocks, metadata: row.metadata, schemaPayload: row.schema_payload, meaningfulText: "" };
}

export interface PublishResult { published: number; skipped: number; manifestVersion: number | null; paths: string[]; blocked?: string }

/**
 * Publisher tick (spec §6.3). Promotes approved versions whose scheduled time has
 * arrived and whose dependencies are already live. Renders indexable HTML to the
 * live prefix, snapshots a new site manifest, and regenerates sitemap + robots
 * from live indexable pages only. On dependency gap the page stays scheduled.
 */
export async function publishDue(
  c: Client,
  opts: { tenantId: string; brandId: string; actorUserId: string; now?: Date }
): Promise<PublishResult> {
  const now = opts.now ?? new Date();
  const brand = await getBrand(c, opts.brandId);
  if (!brand) throw new Error("Brand not found");
  if (brand.status === "paused") return { published: 0, skipped: 0, manifestVersion: null, paths: [] };
  // Compliance gate: a brand cannot go live until legally cleared (spec §9 compliance).
  const compliance = await getBrandCompliance(c, opts.brandId);
  if (!compliance.goLiveReady) return { published: 0, skipped: 0, manifestVersion: null, paths: [], blocked: "Brand is not legally cleared for go-live (see Compliance)" };
  const storage = getStorage();
  const logoDataUri = await getLogoDataUri(c, opts.brandId);

  const due = (await c.query(
    `SELECT ps.id AS sched_id, ps.wave, ps.page_id, ps.page_version_id, sp.path, sp.depends_on,
            pv.blocks, pv.metadata, pv.schema_payload
       FROM publish_schedule ps
       JOIN site_pages sp ON sp.id = ps.page_id
       JOIN page_versions pv ON pv.id = ps.page_version_id
      WHERE ps.brand_id = $1 AND ps.status = 'scheduled' AND ps.scheduled_at <= $2
      ORDER BY ps.wave, ps.scheduled_at`,
    [opts.brandId, now]
  )).rows;

  const publishedIds = new Set<string>(
    (await c.query(`SELECT id FROM site_pages WHERE brand_id = $1 AND deployment_state = 'published'`, [opts.brandId])).rows.map((r) => r.id)
  );

  const result: PublishResult = { published: 0, skipped: 0, manifestVersion: null, paths: [] };
  let changed = false;

  for (const row of due) {
    const depsOk = (row.depends_on as string[]).every((d) => publishedIds.has(d));
    if (!depsOk) { result.skipped++; continue; }

    const html = renderPageHtml({
      family: brand.template_family, brand: { name: brand.name, slug: brand.slug, domain: brand.domain, profile: brand.profile as BrandProfile, logoDataUri },
      page: reconstruct(row), indexable: true, isPreview: false,
    });
    await storage.put(storageKeys.live(brand.slug, row.path), html);

    await c.query(`UPDATE site_pages SET deployment_state = 'published', indexing_state = 'indexable' WHERE id = $1`, [row.page_id]);
    await c.query(`UPDATE publish_schedule SET status = 'published', attempts = attempts + 1 WHERE id = $1`, [row.sched_id]);
    publishedIds.add(row.page_id);
    await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, pageId: row.page_id, eventType: "published", actorUserId: opts.actorUserId, detail: { wave: row.wave, path: row.path } });
    result.published++;
    result.paths.push(row.path);
    changed = true;
  }

  if (changed) {
    result.manifestVersion = await snapshotManifest(c, opts.tenantId, opts.brandId, brand.slug, brand.domain);
  }
  return result;
}

/** Publish ONE page immediately (spec: manual go-live), regardless of its scheduled time. */
export async function publishPageNow(
  c: Client,
  opts: { tenantId: string; brandId: string; pageId: string; actorUserId: string }
): Promise<{ ok: boolean; reason?: string; manifestVersion?: number }> {
  const brand = await getBrand(c, opts.brandId);
  if (!brand) return { ok: false, reason: "Brand not found" };
  if (brand.status === "paused") return { ok: false, reason: "Brand rollout is paused" };
  const compliance = await getBrandCompliance(c, opts.brandId);
  if (!compliance.goLiveReady) return { ok: false, reason: "Brand is not legally cleared for go-live (see Compliance)" };

  const page = (await c.query(
    `SELECT sp.*, pv.blocks, pv.metadata, pv.schema_payload
       FROM site_pages sp LEFT JOIN page_versions pv ON pv.id = sp.current_version_id
      WHERE sp.id = $1 AND sp.brand_id = $2`, [opts.pageId, opts.brandId]
  )).rows[0];
  if (!page) return { ok: false, reason: "Page not found" };
  if (!page.enabled) return { ok: false, reason: "Page is disabled" };
  if (!page.current_version_id) return { ok: false, reason: "Generate the page first" };
  if (page.deployment_state === "published") return { ok: false, reason: "Already live" };
  if (!["approved", "scheduled"].includes(page.deployment_state)) return { ok: false, reason: "Approve the page before launching" };

  // Dependencies must already be live.
  const deps = (page.depends_on as string[]) ?? [];
  if (deps.length) {
    const unmet = (await c.query(
      `SELECT path FROM site_pages WHERE id = ANY($1) AND deployment_state <> 'published'`, [deps]
    )).rows.map((r) => r.path);
    if (unmet.length) return { ok: false, reason: `Publish parent page(s) first: ${unmet.join(", ")}` };
  }

  const logoDataUri = await getLogoDataUri(c, opts.brandId);
  const html = renderPageHtml({
    family: brand.template_family, brand: { name: brand.name, slug: brand.slug, domain: brand.domain, profile: brand.profile as BrandProfile, logoDataUri },
    page: reconstruct(page), indexable: true, isPreview: false,
  });
  await getStorage().put(storageKeys.live(brand.slug, page.path), html);
  await c.query(`UPDATE site_pages SET deployment_state='published', indexing_state='indexable' WHERE id=$1`, [opts.pageId]);
  // Mark an existing scheduled row published, or record an immediate one.
  const upd = await c.query(`UPDATE publish_schedule SET status='published', scheduled_at=now() WHERE brand_id=$1 AND page_id=$2 AND status='scheduled'`, [opts.brandId, opts.pageId]);
  if ((upd.rowCount ?? 0) === 0) {
    await c.query(
      `INSERT INTO publish_schedule (tenant_id, brand_id, page_id, page_version_id, wave, scheduled_at, status, reason)
       VALUES ($1,$2,$3,$4,0,now(),'published','manual launch')
       ON CONFLICT (page_id, wave) DO UPDATE SET status='published', scheduled_at=now()`,
      [opts.tenantId, opts.brandId, opts.pageId, page.current_version_id]
    );
  }
  await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, pageId: opts.pageId, eventType: "published", actorUserId: opts.actorUserId, detail: { path: page.path, manual: true } });
  const mv = await snapshotManifest(c, opts.tenantId, opts.brandId, brand.slug, brand.domain);
  return { ok: true, manifestVersion: mv };
}

/** Snapshot the current live page-version set as a new manifest and regen sitemap/robots. */
async function snapshotManifest(c: Client, tenantId: string, brandId: string, slug: string, domain: string): Promise<number> {
  const live = (await c.query(
    `SELECT sp.path, sp.current_version_id, sp.indexing_state FROM site_pages sp
      WHERE sp.brand_id = $1 AND sp.deployment_state = 'published' ORDER BY sp.path`,
    [brandId]
  )).rows;

  const entries: Record<string, string> = {};
  const indexable: string[] = [];
  for (const r of live) {
    entries[r.path] = r.current_version_id;
    if (r.indexing_state === "indexable") indexable.push(r.path);
  }

  const nextV = (await c.query(`SELECT COALESCE(max(version),0)+1 AS n FROM site_manifests WHERE brand_id = $1`, [brandId])).rows[0].n;
  await c.query(`UPDATE site_manifests SET is_live = false WHERE brand_id = $1`, [brandId]);
  await c.query(
    `INSERT INTO site_manifests (tenant_id, brand_id, version, entries, indexable_paths, is_live, note)
     VALUES ($1,$2,$3,$4,$5,true,$6)`,
    [tenantId, brandId, nextV, entries, JSON.stringify(indexable), `auto snapshot (${indexable.length} indexable)`]
  );
  await regenSiteFiles(slug, domain, indexable);
  return nextV;
}

async function regenSiteFiles(slug: string, domain: string, indexablePaths: string[]) {
  const storage = getStorage();
  const urls = indexablePaths.map((p) => `  <url><loc>https://${domain}${p}</loc></url>`).join("\n");
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  await storage.put(storageKeys.sitemap(slug), sitemap);
  const robots = `User-agent: *\nAllow: /\nSitemap: https://${domain}/sitemap.xml\n`;
  await storage.put(storageKeys.robots(slug), robots);
}

/** Roll back to the previous live manifest by moving the pointer (spec §6.4). */
export async function rollbackBrand(
  c: Client,
  opts: { tenantId: string; brandId: string; actorUserId: string }
): Promise<{ ok: boolean; reason?: string; restoredVersion?: number }> {
  const brand = await getBrand(c, opts.brandId);
  if (!brand) return { ok: false, reason: "Brand not found" };

  const manifests = (await c.query(`SELECT * FROM site_manifests WHERE brand_id = $1 ORDER BY version DESC LIMIT 2`, [opts.brandId])).rows;
  if (manifests.length < 2) return { ok: false, reason: "No previous manifest to roll back to." };
  const [current, prior] = manifests;

  const priorPaths = new Set<string>(Object.keys(prior.entries));
  const priorIndexable = new Set<string>(prior.indexable_paths);

  // Pages present in current but not prior => pause + de-index + remove live file.
  const storage = getStorage();
  for (const path of Object.keys(current.entries)) {
    if (!priorPaths.has(path)) {
      await c.query(
        `UPDATE site_pages SET deployment_state = 'paused', indexing_state = 'noindex' WHERE brand_id = $1 AND path = $2`,
        [opts.brandId, path]
      );
      await storage.remove(storageKeys.live(brand.slug, path));
    }
  }
  // Restore indexing state for prior pages.
  for (const path of priorPaths) {
    await c.query(
      `UPDATE site_pages SET deployment_state = 'published', indexing_state = $3 WHERE brand_id = $1 AND path = $2`,
      [opts.brandId, path, priorIndexable.has(path) ? "indexable" : "noindex"]
    );
  }

  await c.query(`UPDATE site_manifests SET is_live = false WHERE brand_id = $1`, [opts.brandId]);
  await c.query(`UPDATE site_manifests SET is_live = true WHERE id = $1`, [prior.id]);
  await regenSiteFiles(brand.slug, brand.domain, [...priorIndexable]);

  await audit(c, {
    tenantId: opts.tenantId, brandId: opts.brandId, eventType: "rolled_back", actorUserId: opts.actorUserId,
    fromVersion: current.version, toVersion: prior.version,
    detail: { removed: Object.keys(current.entries).filter((p) => !priorPaths.has(p)) },
  });
  return { ok: true, restoredVersion: prior.version };
}

/** Emergency stop: pause the whole site rollout. */
export async function pauseBrand(c: Client, opts: { tenantId: string; brandId: string; actorUserId: string }) {
  await c.query(`UPDATE brands SET status = 'paused' WHERE id = $1`, [opts.brandId]);
  await c.query(`UPDATE publish_schedule SET status = 'paused' WHERE brand_id = $1 AND status = 'scheduled'`, [opts.brandId]);
  await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, eventType: "paused", actorUserId: opts.actorUserId, detail: { scope: "site" } });
}

export async function resumeBrand(c: Client, opts: { tenantId: string; brandId: string; actorUserId: string }) {
  await c.query(`UPDATE brands SET status = 'active' WHERE id = $1`, [opts.brandId]);
  await c.query(`UPDATE publish_schedule SET status = 'scheduled' WHERE brand_id = $1 AND status = 'paused'`, [opts.brandId]);
}
