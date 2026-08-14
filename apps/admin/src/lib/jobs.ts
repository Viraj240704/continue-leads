import "server-only";
import crypto from "node:crypto";
import type { Client } from "./db";
import { getPack } from "./packs";
import { getBrand } from "./sites";
import { getContentProvider } from "./adapters/provider";
import { getEmbedder, toVectorLiteral } from "./adapters/embeddings";
import { getStorage, storageKeys } from "./adapters/storage";
import { renderPageHtml, TEMPLATE_VERSION } from "./templates";
import { runQa, persistQa, meaningfulHash } from "./qa";
import { audit } from "./audit";
import { getBrandSuppliedText, getLogoDataUri } from "./assets";
import { seeded } from "./rng";
import { APPROACH, LOCAL, OUTCOME, compose } from "./adapters/contentbank";
import type { BrandProfile, Block, PackService, PageType, VerticalPackConfig } from "./types";

const PROMPT_VERSION = "v1";

/**
 * Add a fresh content section to a page (grows it) — creates a NEW version with the
 * existing blocks plus one appended section, then re-renders/embeds/QAs. Distinct
 * from regenerate, which replaces the whole page.
 */
export async function addContentToPage(
  c: Client,
  opts: { tenantId: string; brandId: string; pageId: string; actorUserId: string }
): Promise<{ ok: boolean; reason?: string; version?: number }> {
  const brand = await getBrand(c, opts.brandId);
  if (!brand) return { ok: false, reason: "Brand not found" };
  const pack = await getPack(c, brand.vertical_pack_id);
  if (!pack) return { ok: false, reason: "Pack not found" };
  const profile = brand.profile as BrandProfile;

  const page = (await c.query(`SELECT * FROM site_pages WHERE id = $1 AND brand_id = $2`, [opts.pageId, opts.brandId])).rows[0];
  if (!page?.current_version_id) return { ok: false, reason: "Generate the page first" };
  const cur = (await c.query(`SELECT * FROM page_versions WHERE id = $1`, [page.current_version_id])).rows[0];

  const city = page.context?.city ?? profile.cities[0] ?? profile.addressCity;
  const service = page.context?.service ? pack.config.services.find((s: PackService) => s.slug === page.context.service) : undefined;
  const svc = service?.name ?? (pack.config.vocabulary.craft as string) ?? pack.name;
  const versionNo = (await c.query(`SELECT COALESCE(max(version),0)+1 AS n FROM page_versions WHERE page_id = $1`, [opts.pageId])).rows[0].n;

  // Fresh seed (page + new version) so each added section is genuinely different.
  const rng = seeded(`${brand.slug}:${page.path}:add:${versionNo}`);
  const adj = profile.voiceAdjectives[0] ?? "reliable";
  const vars = { brand: brand.name, service: svc, svc: svc.toLowerCase(), city, actor: "team", craft: (pack.config.vocabulary.craft as string) ?? "service", craftCap: svc, adj, adj2: profile.voiceAdjectives[1] ?? "careful", adjCap: adj, years: String(profile.yearsInBusiness) };
  const heading = rng.pick([`More on ${svc.toLowerCase()} in ${city}`, `What to expect from ${brand.name}`, `${city} ${svc.toLowerCase()}: the details`]);
  const newSection: Block = { type: "richText", heading, paragraphs: [compose(rng, APPROACH, vars, 1), compose(rng, OUTCOME, vars, 1), compose(rng, LOCAL, vars, 1)] };

  // Insert before the first CTA/leadForm (keep the form/CTA at the end).
  const blocks: Block[] = [...(cur.blocks as Block[])];
  const insertAt = blocks.findIndex((b) => b.type === "cta" || b.type === "leadForm");
  blocks.splice(insertAt < 0 ? blocks.length : insertAt, 0, newSection);

  const meaningfulText = blocks
    .filter((b) => b.type === "hero" || b.type === "richText" || b.type === "legal")
    .flatMap((b: any) => (b.type === "hero" ? [b.headline, b.subhead] : b.paragraphs ?? []))
    .join(" ").replace(/\s+/g, " ").trim();
  const contentHash = meaningfulHash(meaningfulText);

  const pv = await c.query(
    `INSERT INTO page_versions (tenant_id, page_id, version, blocks, metadata, schema_payload, content_hash, template_version, gen_metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    [opts.tenantId, opts.pageId, versionNo, JSON.stringify(blocks), cur.metadata, cur.schema_payload, contentHash, TEMPLATE_VERSION,
     { ...cur.gen_metadata, addedContent: true, basedOnVersion: cur.version }]
  );
  const versionId = pv.rows[0].id as string;

  const logoDataUri = await getLogoDataUri(c, opts.brandId);
  const html = renderPageHtml({
    family: brand.template_family, brand: { name: brand.name, slug: brand.slug, domain: brand.domain, profile, logoDataUri },
    page: { blocks, metadata: cur.metadata, schemaPayload: cur.schema_payload, meaningfulText }, indexable: false, isPreview: true,
  });
  const renderUri = storageKeys.preview(brand.slug, versionId);
  await getStorage().put(renderUri, html);
  await c.query(`UPDATE page_versions SET render_uri = $1 WHERE id = $2`, [renderUri, versionId]);

  const emb = await getEmbedder().embed(meaningfulText);
  await c.query(
    `INSERT INTO page_embeddings (tenant_id, brand_id, page_version_id, source_hash, embedding)
     VALUES ($1,$2,$3,$4,$5::vector) ON CONFLICT (page_version_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_hash = EXCLUDED.source_hash`,
    [opts.tenantId, opts.brandId, versionId, contentHash, toVectorLiteral(emb)]
  );

  const knownPaths = new Set<string>((await c.query(`SELECT path FROM site_pages WHERE brand_id = $1`, [opts.brandId])).rows.map((r) => r.path));
  const qa = await runQa(c, { tenantId: opts.tenantId, pageVersionId: versionId, pageId: opts.pageId, brandId: opts.brandId, pageType: page.page_type, html, page: { blocks, metadata: cur.metadata, schemaPayload: cur.schema_payload, meaningfulText }, contentHash, pack: pack.config as VerticalPackConfig, knownPaths });
  await persistQa(c, opts.tenantId, versionId, qa);

  // Adding content returns the page to a review state (needs re-approval before publish).
  const newState = qa.status === "fail" ? "qa_failed" : "generated";
  await c.query(`UPDATE site_pages SET current_version_id = $1, deployment_state = $2 WHERE id = $3`, [versionId, newState, opts.pageId]);
  await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, pageId: opts.pageId, eventType: "generated", actorUserId: opts.actorUserId, toVersion: versionNo, detail: { addedContent: true, qa: qa.status, path: page.path } });

  return { ok: true, version: versionNo };
}

export interface GenerateSummary {
  batchId: string;
  generated: number;
  qaPass: number;
  qaWarn: number;
  qaFail: number;
  costUsd: number;
}

/**
 * Generation pipeline (spec §6.2). For each target page: content -> version ->
 * render -> preview store -> embed -> QA -> record job + audit. Idempotent per
 * (batch, page); safe to retry. Pages stay noindex until approved + published.
 */
export async function generatePages(
  c: Client,
  opts: { tenantId: string; brandId: string; actorUserId: string; pageIds?: string[] }
): Promise<GenerateSummary> {
  const brand = await getBrand(c, opts.brandId);
  if (!brand) throw new Error("Brand not found");
  const pack = await getPack(c, brand.vertical_pack_id);
  if (!pack) throw new Error("Pack not found");
  const profile = brand.profile as BrandProfile;
  const provider = getContentProvider();
  const embedder = getEmbedder();
  const storage = getStorage();

  const pagesRes = await c.query(
    `SELECT * FROM site_pages WHERE brand_id = $1 AND enabled = true ${opts.pageIds?.length ? "AND id = ANY($2)" : ""} ORDER BY priority, path`,
    opts.pageIds?.length ? [opts.brandId, opts.pageIds] : [opts.brandId]
  );
  const pages = pagesRes.rows;
  const knownPaths = new Set<string>((await c.query(`SELECT path FROM site_pages WHERE brand_id = $1`, [opts.brandId])).rows.map((r) => r.path));

  const aboutText = await getBrandSuppliedText(c, opts.brandId);
  const logoDataUri = await getLogoDataUri(c, opts.brandId);
  const batchId = crypto.randomUUID();
  const summary: GenerateSummary = { batchId, generated: 0, qaPass: 0, qaWarn: 0, qaFail: 0, costUsd: 0 };

  for (const page of pages) {
    const idempotencyKey = `${opts.brandId}:${page.id}:${PROMPT_VERSION}:${batchId}`;
    const service: PackService | undefined = page.context?.service
      ? pack.config.services.find((s) => s.slug === page.context.service)
      : undefined;

    // 1. content
    const { page: gen, usage } = await provider.generate({
      pack: pack.config as VerticalPackConfig,
      brand: { slug: brand.slug, name: brand.name, domain: brand.domain, profile },
      page: { type: page.page_type as PageType, path: page.path, title: page.title, service, city: page.context?.city },
      brief: brand.brief, aboutText, pageBrief: page.brief,
      promptVersion: PROMPT_VERSION,
    });
    const contentHash = meaningfulHash(gen.meaningfulText);

    // 2. version row
    const versionNo = (await c.query(`SELECT COALESCE(max(version),0)+1 AS n FROM page_versions WHERE page_id = $1`, [page.id])).rows[0].n;
    const pv = await c.query(
      `INSERT INTO page_versions (tenant_id, page_id, version, blocks, metadata, schema_payload, content_hash, template_version, gen_metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        opts.tenantId, page.id, versionNo,
        JSON.stringify(gen.blocks), gen.metadata, gen.schemaPayload, contentHash, TEMPLATE_VERSION,
        { model: provider.model, promptVersion: PROMPT_VERSION, packVersion: pack.version, seed: `${brand.slug}:${page.path}` },
      ]
    );
    const versionId = pv.rows[0].id as string;

    // 3. render + preview store
    const html = renderPageHtml({
      family: brand.template_family, brand: { name: brand.name, slug: brand.slug, domain: brand.domain, profile, logoDataUri },
      page: gen, indexable: false, isPreview: true,
    });
    const renderUri = storageKeys.preview(brand.slug, versionId);
    await storage.put(renderUri, html);
    await c.query(`UPDATE page_versions SET render_uri = $1 WHERE id = $2`, [renderUri, versionId]);

    // 4. embed (upsert per version)
    const emb = await embedder.embed(gen.meaningfulText);
    await c.query(
      `INSERT INTO page_embeddings (tenant_id, brand_id, page_version_id, source_hash, embedding)
       VALUES ($1,$2,$3,$4,$5::vector)
       ON CONFLICT (page_version_id) DO UPDATE SET embedding = EXCLUDED.embedding, source_hash = EXCLUDED.source_hash`,
      [opts.tenantId, opts.brandId, versionId, contentHash, toVectorLiteral(emb)]
    );

    // 5. QA
    const qa = await runQa(c, {
      tenantId: opts.tenantId, pageVersionId: versionId, pageId: page.id, brandId: opts.brandId,
      pageType: page.page_type, html, page: gen, contentHash, pack: pack.config as VerticalPackConfig, knownPaths,
    });
    await persistQa(c, opts.tenantId, versionId, qa);

    // 6. page state (deployment vs indexing kept separate)
    const newState = qa.status === "fail" ? "qa_failed" : "generated";
    await c.query(`UPDATE site_pages SET current_version_id = $1, deployment_state = $2 WHERE id = $3`, [versionId, newState, page.id]);

    // 7. job record + audit
    await c.query(
      `INSERT INTO generation_jobs (tenant_id, brand_id, page_id, page_version_id, batch_id, status, model, prompt_version, estimate_cost, actual_cost, attempts, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'succeeded',$6,$7,$8,$8,1,$9)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [opts.tenantId, opts.brandId, page.id, versionId, batchId, provider.model, PROMPT_VERSION, usage.costUsd, idempotencyKey]
    );
    await audit(c, {
      tenantId: opts.tenantId, brandId: opts.brandId, pageId: page.id, eventType: "generated",
      actorUserId: opts.actorUserId, toVersion: versionNo,
      detail: { qa: qa.status, similarity: qa.topSimilarity, costUsd: round(usage.costUsd), path: page.path },
    });

    summary.generated++;
    summary.costUsd += usage.costUsd;
    if (qa.status === "pass") summary.qaPass++;
    else if (qa.status === "warn") summary.qaWarn++;
    else summary.qaFail++;
  }

  summary.costUsd = round(summary.costUsd);
  await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, eventType: "cost", actorUserId: opts.actorUserId, detail: { batchId, costUsd: summary.costUsd, pages: summary.generated } });
  return summary;
}

function round(n: number) { return Math.round(n * 10000) / 10000; }
