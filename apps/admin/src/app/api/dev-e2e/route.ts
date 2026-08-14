import { NextRequest } from "next/server";
import { withSystem, withTenant } from "@/lib/db";
import { listPacks } from "@/lib/packs";
import { createBrandWithPlan } from "@/lib/sites";
import { generatePages } from "@/lib/jobs";
import { approveAllEligible } from "@/lib/approvals";
import { buildSchedule } from "@/lib/scheduler";
import { publishDue, rollbackBrand } from "@/lib/publisher";
import { captureLead } from "@/lib/leads";
import { DESIGN_PRESETS } from "@/lib/presets";
import type { BrandProfile } from "@/lib/types";

// DEV-ONLY end-to-end smoke test of the full pipeline. Disabled in production.
export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("disabled", { status: 403 });
  const report: any = { steps: [] };
  const log = (k: string, v: any) => report.steps.push({ [k]: v });

  try {
    const ctx = await withSystem(async (c) => {
      const u = (await c.query(`SELECT id, tenant_id FROM users WHERE role IN ('admin','platform_admin') LIMIT 1`)).rows[0];
      // Clean prior test runs so the similarity corpus isn't polluted across repeated e2e runs.
      await c.query(`DELETE FROM brands WHERE name LIKE 'E2E %'`);
      await c.query(`DELETE FROM buyers WHERE name IN ('Rivertown Lead Co','Acme Home Services')`);
      return { tenantId: u.tenant_id as string, userId: u.id as string };
    });
    log("tenant", ctx.tenantId);

    const packs = await withTenant(ctx.tenantId, (c) => listPacks(c));
    const painting = packs.find((p) => p.key === "painting")!;
    const allSvc = painting.config.services.map((s) => s.slug);

    function profile(preset: (typeof DESIGN_PRESETS)[number], tag: string, services: string[], cities: string[], baseCity: string): BrandProfile {
      return {
        tagline: `${tag} — quality you can trust`, tone: preset.tone, voiceAdjectives: preset.voiceAdjectives,
        ctaStyle: preset.ctaStyle, palette: preset.palette, typography: preset.typography,
        phone: "(555) 010-0000", email: `hi@${tag}.test`, addressCity: baseCity,
        yearsInBusiness: 10, licenseRef: "Lic #TEST", services, cities, analytics: {},
      };
    }
    // Two brands, SAME vertical, DIFFERENT design + geography + service mix — realistic pilot.
    const aServices = allSvc.slice(0, 3), aCities = ["Springfield", "Riverside"];
    const bServices = allSvc.slice(1, 4), bCities = ["Fairview", "Lakeside"];

    const stamp = Date.now().toString(36);
    const brandAId = await withTenant(ctx.tenantId, (c) => createBrandWithPlan(c, ctx.tenantId, ctx.userId, {
      name: `E2E Alpha ${stamp}`, slug: `e2e-alpha-${stamp}`, domain: `alpha-${stamp}.test`,
      verticalPackId: painting.id, templateFamily: DESIGN_PRESETS[0]!.templateFamily,
      profile: profile(DESIGN_PRESETS[0]!, `alpha-${stamp}`, aServices, aCities, "Springfield"),
      rollout: { launchSize: 8, weeklyTargets: [6, 8, 12], dailyCap: 3, timezone: "America/New_York" },
    }));
    const brandBId = await withTenant(ctx.tenantId, (c) => createBrandWithPlan(c, ctx.tenantId, ctx.userId, {
      name: `E2E Beta ${stamp}`, slug: `e2e-beta-${stamp}`, domain: `beta-${stamp}.test`,
      verticalPackId: painting.id, templateFamily: DESIGN_PRESETS[1]!.templateFamily,
      profile: profile(DESIGN_PRESETS[1]!, `beta-${stamp}`, bServices, bCities, "Fairview"),
      rollout: { launchSize: 8, weeklyTargets: [6, 8, 12], dailyCap: 3, timezone: "America/New_York" },
    }));
    log("brands_created", { brandAId, brandBId });

    const genA = await withTenant(ctx.tenantId, (c) => generatePages(c, { tenantId: ctx.tenantId, brandId: brandAId, actorUserId: ctx.userId }));
    const genB = await withTenant(ctx.tenantId, (c) => generatePages(c, { tenantId: ctx.tenantId, brandId: brandBId, actorUserId: ctx.userId }));
    log("generate_A", genA);
    log("generate_B", genB);

    // Differentiation proof: highest similarity any Beta CONTENT page hit vs the whole
    // corpus. Must stay below the 0.85 block threshold for distinct brands.
    const sim = await withTenant(ctx.tenantId, async (c) => {
      const { rows } = await c.query(
        `SELECT max((qr.summary->>'topSimilarity')::float) AS max_sim
           FROM qa_runs qr JOIN page_versions pv ON pv.id = qr.page_version_id
           JOIN site_pages sp ON sp.id = pv.page_id
          WHERE sp.brand_id = $1 AND sp.page_type NOT IN ('PRIVACY','TERMS','TCPA','CONTACT')`, [brandBId]);
      return rows[0].max_sim;
    });
    log("max_content_similarity_B", sim);
    report.differentiation_pass = sim === null || Number(sim) < 0.85;
    report.no_qa_failures = genA.qaFail === 0 && genB.qaFail === 0;

    const apprA = await withTenant(ctx.tenantId, (c) => approveAllEligible(c, { tenantId: ctx.tenantId, brandId: brandAId, reviewerUserId: ctx.userId }));
    log("approved_A", apprA);

    const waves = await withTenant(ctx.tenantId, (c) => buildSchedule(c, { tenantId: ctx.tenantId, brandId: brandAId, actorUserId: ctx.userId }));
    log("schedule_A", waves.map((w) => ({ wave: w.wave, count: w.count })));

    // Compliance gate B: publishing is blocked until legal sign-off. Approve brand A to proceed.
    await withTenant(ctx.tenantId, (c) => c.query(`UPDATE brands SET legal_approved=true, legal_approved_at=now() WHERE id=$1`, [brandAId]));
    const now = new Date();
    const pub1 = await withTenant(ctx.tenantId, (c) => publishDue(c, { tenantId: ctx.tenantId, brandId: brandAId, actorUserId: ctx.userId, now }));
    log("publish_tick_1_launch", pub1);
    // Advance ~8 days to promote the week-1 wave, creating a second live manifest.
    const later = new Date(now.getTime() + 8 * 86_400_000);
    const pub2 = await withTenant(ctx.tenantId, (c) => publishDue(c, { tenantId: ctx.tenantId, brandId: brandAId, actorUserId: ctx.userId, now: later }));
    log("publish_tick_2_week1", pub2);

    // Lead capture (exactly once)
    const lead1 = await captureLead({ brandSlug: `e2e-alpha-${stamp}`, name: "Test User", phone: "5551112222", consent: true, utm: { utm_source: "test" }, ip: "10.0.0.1", pagePath: "/" });
    const lead2 = await captureLead({ brandSlug: `e2e-alpha-${stamp}`, name: "Test User", phone: "5551112222", consent: true, utm: {}, ip: "10.0.0.1", pagePath: "/" });
    log("lead_first", lead1);
    log("lead_duplicate", lead2);

    // Rollback (needs >=2 manifests): publish more then rollback
    const rb = await withTenant(ctx.tenantId, (c) => rollbackBrand(c, { tenantId: ctx.tenantId, brandId: brandAId, actorUserId: ctx.userId }));
    log("rollback_A", rb);

    // ---- New feature coverage: brief, logo, assets, domain, lead validation/sale ----
    const { createAsset } = await import("@/lib/assets");
    const { checkDomain, purchaseDomain } = await import("@/lib/domains");
    const { listLeads, markLeadSold } = await import("@/lib/leads-admin");

    // brief + about-us asset + a 1x1 PNG logo, then regenerate the HOME page and check embeds.
    const brandA2 = brandAId;
    await withTenant(ctx.tenantId, async (c) => {
      await c.query(`UPDATE brands SET brief=$1 WHERE id=$2`, ["Family-owned since 1998, eco-friendly low-VOC paints, same-week scheduling.", brandA2]);
      const brand = (await c.query(`SELECT slug FROM brands WHERE id=$1`, [brandA2])).rows[0];
      await createAsset(c, { tenantId: ctx.tenantId, brandId: brandA2, brandSlug: brand.slug, kind: "about", textContent: "Copperline began as a two-person crew and now serves the whole metro.\n\nWe still answer the phone ourselves." });
      const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
      await createAsset(c, { tenantId: ctx.tenantId, brandId: brandA2, brandSlug: brand.slug, kind: "logo", filename: "logo.png", contentType: "image/png", bytes: png });
    });
    const regen = await withTenant(ctx.tenantId, (c) => generatePages(c, { tenantId: ctx.tenantId, brandId: brandA2, actorUserId: ctx.userId, pageIds: undefined }));
    const homeCheck = await withTenant(ctx.tenantId, async (c) => {
      const row = (await c.query(
        `SELECT pv.blocks, pv.render_uri FROM site_pages sp JOIN page_versions pv ON pv.id=sp.current_version_id
          WHERE sp.brand_id=$1 AND sp.path='/'`, [brandA2])).rows[0];
      const hasBrief = JSON.stringify(row.blocks).includes("What sets us apart");
      const { getStorage } = await import("@/lib/adapters/storage");
      const html = await getStorage().get(row.render_uri);
      return { hasBriefBlock: hasBrief, logoEmbedded: !!html && html.includes("data:image/png;base64") };
    });
    log("brief_and_logo", { regenerated: regen.generated, ...homeCheck });

    // Domain check + simulated registration
    const dq = await checkDomain("copperline-demo-xyz.com");
    const dp = await withTenant(ctx.tenantId, (c) => purchaseDomain(c, { tenantId: ctx.tenantId, brandId: brandA2, domain: dq.available ? dq.domain : (dq.suggestions.find((s) => s.available)?.domain ?? "fallback-xyz.net"), actorUserId: ctx.userId }));
    log("domain", { checked: dq.domain, available: dq.available, purchase: dp });

    // Lead validation: submit a strong lead + a junk lead, then sell the good one.
    const good = await captureLead({ brandSlug: `e2e-alpha-${stamp}`, name: "Jordan Blake", phone: "512-555-7788", email: "jordan@gmail.com", message: "Need my kitchen and living room painted next week.", consent: true, utm: { utm_source: "google" }, ip: "10.0.0.9", pagePath: "/services/interior-painting/springfield" });
    const junk = await captureLead({ brandSlug: `e2e-alpha-${stamp}`, name: "x", phone: "123", consent: true, utm: {}, ip: "10.0.0.10", pagePath: "/" });
    const leadRows = await withTenant(ctx.tenantId, (c) => listLeads(c, { brandId: brandA2 }));
    const goodLead = leadRows.find((l) => l.validation_status === "valid");
    const sold = goodLead ? await withTenant(ctx.tenantId, async (c) => {
      const { createBuyer, setBuyerApproval } = await import("@/lib/buyers");
      const acme = await createBuyer(c, { tenantId: ctx.tenantId, name: "Acme Home Services", company: "Acme" });
      await setBuyerApproval(c, acme.id, true);
      return markLeadSold(c, { tenantId: ctx.tenantId, leadId: goodLead.id, buyer: acme.name, buyerId: acme.id, actorUserId: ctx.userId });
    }) : { ok: false, reason: "no valid lead" };
    log("lead_validation", {
      good, junk,
      statuses: leadRows.map((l) => ({ status: l.validation_status, score: l.quality_score, price: l.price_usd, sale: l.sale_status })),
      sold,
    });
    report.new_features_pass =
      homeCheck.hasBriefBlock && homeCheck.logoEmbedded && dp.ok && sold.ok &&
      leadRows.some((l) => l.validation_status === "valid") && leadRows.some((l) => l.validation_status === "invalid");

    // ---- Per-page controls: disable a page + per-page brief ----
    const roofing = packs.find((p) => p.key === "roofing")!;
    const brandCId = await withTenant(ctx.tenantId, (c) => createBrandWithPlan(c, ctx.tenantId, ctx.userId, {
      name: `E2E Gamma ${stamp}`, slug: `e2e-gamma-${stamp}`, domain: `gamma-${stamp}.test`,
      verticalPackId: roofing.id, templateFamily: DESIGN_PRESETS[3]!.templateFamily,
      profile: profile(DESIGN_PRESETS[3]!, `gamma-${stamp}`, ["roof-repair", "storm-damage"], ["Denver"], "Denver"),
      rollout: { launchSize: 6, weeklyTargets: [6, 8], dailyCap: 3, timezone: "America/Denver" },
    }));
    const pageBriefText = "Emphasize 24/7 emergency response and free drone roof inspections.";
    await withTenant(ctx.tenantId, async (c) => {
      await c.query(`UPDATE site_pages SET enabled=false WHERE brand_id=$1 AND path='/contact'`, [brandCId]);
      await c.query(`UPDATE site_pages SET brief=$2 WHERE brand_id=$1 AND path='/services/roof-repair'`, [brandCId, pageBriefText]);
    });
    const genC = await withTenant(ctx.tenantId, (c) => generatePages(c, { tenantId: ctx.tenantId, brandId: brandCId, actorUserId: ctx.userId }));
    const pageCtl = await withTenant(ctx.tenantId, async (c) => {
      const contact = (await c.query(`SELECT current_version_id, enabled FROM site_pages WHERE brand_id=$1 AND path='/contact'`, [brandCId])).rows[0];
      const svc = (await c.query(
        `SELECT pv.blocks FROM site_pages sp JOIN page_versions pv ON pv.id=sp.current_version_id
          WHERE sp.brand_id=$1 AND sp.path='/services/roof-repair'`, [brandCId])).rows[0];
      return {
        disabledPageSkipped: contact && contact.enabled === false && contact.current_version_id === null,
        pageBriefInjected: !!svc && JSON.stringify(svc.blocks).includes(pageBriefText),
      };
    });
    log("per_page_controls", { generated: genC.generated, planTotal: 18, ...pageCtl });
    report.per_page_pass = pageCtl.disabledPageSkipped && pageCtl.pageBriefInjected && genC.generated < 18;

    // ---- Launch-now (single page) + buyer delivery ----
    const { publishPageNow } = await import("@/lib/publisher");
    const { getLeadByDeliveryToken } = await import("@/lib/leads-admin");
    await withTenant(ctx.tenantId, (c) => approveAllEligible(c, { tenantId: ctx.tenantId, brandId: brandCId, reviewerUserId: ctx.userId }));
    const ids = await withTenant(ctx.tenantId, async (c) => ({
      home: (await c.query(`SELECT id FROM site_pages WHERE brand_id=$1 AND path='/'`, [brandCId])).rows[0]?.id,
      money: (await c.query(`SELECT id, path FROM site_pages WHERE brand_id=$1 AND page_type='MONEY' LIMIT 1`, [brandCId])).rows[0],
    }));
    // Gate B in action: publish is blocked before legal sign-off, allowed after.
    const launchBlocked = await withTenant(ctx.tenantId, (c) => publishPageNow(c, { tenantId: ctx.tenantId, brandId: brandCId, pageId: ids.home, actorUserId: ctx.userId }));
    await withTenant(ctx.tenantId, (c) => c.query(`UPDATE brands SET legal_approved=true, legal_approved_at=now() WHERE id=$1`, [brandCId]));
    const launchHome = await withTenant(ctx.tenantId, (c) => publishPageNow(c, { tenantId: ctx.tenantId, brandId: brandCId, pageId: ids.home, actorUserId: ctx.userId }));
    const launchMoney = ids.money ? await withTenant(ctx.tenantId, (c) => publishPageNow(c, { tenantId: ctx.tenantId, brandId: brandCId, pageId: ids.money.id, actorUserId: ctx.userId })) : { ok: true };

    // Delivery: the good lead sold earlier has a token — fetch it as a buyer would.
    const deliveryToken = (sold as any).deliveryToken;
    const delivered = deliveryToken ? await getLeadByDeliveryToken(deliveryToken) : null;
    log("launch_and_delivery", {
      publishBlockedBeforeSignoff: !launchBlocked.ok, blockReason: (launchBlocked as any).reason ?? null,
      launchHomeOk: launchHome.ok,
      launchMoneyBlocked: !launchMoney.ok, launchMoneyReason: (launchMoney as any).reason ?? null,
      deliveryHasContact: !!delivered && !!delivered.contact.phone, deliveredBuyer: delivered?.buyer,
    });
    report.three_features_pass = !launchBlocked.ok && launchHome.ok && !launchMoney.ok && !!delivered?.contact?.phone;

    // ---- Buyers model + approval gate (Gate A) + CSV export ----
    const { createBuyer, setBuyerApproval, getBuyerPortal } = await import("@/lib/buyers");
    const { soldLeadsCsv } = await import("@/lib/csv");
    const buyer = await withTenant(ctx.tenantId, (c) => createBuyer(c, { tenantId: ctx.tenantId, name: "Rivertown Lead Co", company: "Rivertown", email: "ops@rivertown.test", verticals: ["painting"], geos: ["TX"], bidFloor: 25, termsAccepted: true }));
    await captureLead({ brandSlug: `e2e-alpha-${stamp}`, name: "Casey Doyle", phone: "512-555-9090", email: "casey@gmail.com", message: "Need a full interior repaint next week.", consent: true, utm: { utm_source: "bing" }, ip: "10.0.0.55", pagePath: "/services/interior-painting" });
    const gate = await withTenant(ctx.tenantId, async (c) => {
      const fresh = (await c.query(`SELECT id FROM leads WHERE brand_id=$1 AND validation_status='valid' AND sale_status='for_sale' ORDER BY created_at DESC LIMIT 1`, [brandAId])).rows[0];
      if (!fresh) return { pending: { ok: false }, approved: { ok: false, reason: "no sellable lead" } };
      // Gate A: selling to a PENDING buyer is blocked.
      const pending = await markLeadSold(c, { tenantId: ctx.tenantId, leadId: fresh.id, buyer: buyer.name, buyerId: buyer.id, actorUserId: ctx.userId });
      await setBuyerApproval(c, buyer.id, true);
      const approved = await markLeadSold(c, { tenantId: ctx.tenantId, leadId: fresh.id, buyer: buyer.name, buyerId: buyer.id, actorUserId: ctx.userId });
      return { pending, approved };
    });
    const portal = await getBuyerPortal(buyer.access_token);
    const csv = await withTenant(ctx.tenantId, (c) => soldLeadsCsv(c, {}));
    log("buyers_and_csv", {
      buyerCreated: !!buyer.id, sellToPendingBlocked: !gate.pending.ok, sellToApprovedOk: gate.approved.ok,
      portalLeadCount: portal?.leads.length ?? 0, portalHasContact: !!portal?.leads?.[0]?.contact?.phone,
      csvHeaderOk: csv.startsWith("sold_at,lead_id,brand,buyer"), csvRows: csv.trim().split("\n").length - 1, csvHasBuyer: csv.includes("Rivertown"),
    });
    report.buyers_pass = !!buyer.id && !gate.pending.ok && gate.approved.ok && (portal?.leads.length ?? 0) >= 1 && csv.includes("Rivertown");

    // ---- Analytics + freshness (features 2 & 4) ----
    const { getAnalytics } = await import("@/lib/analytics");
    const { getFreshness } = await import("@/lib/freshness");
    const analytics = await withTenant(ctx.tenantId, (c) => getAnalytics(c));
    const freshAll = await withTenant(ctx.tenantId, (c) => getFreshness(c, 90));
    const freshStrict = await withTenant(ctx.tenantId, (c) => getFreshness(c, 0)); // everything is "stale" at 0-day threshold
    log("analytics_and_freshness", {
      brands: analytics.brands.total, livePages: analytics.pages.published, qaRate: analytics.qa.rate,
      revenue: analytics.leads.revenue, revenueByBuyerRows: analytics.revenueByBuyer.length,
      freshPagesTracked: freshAll.rows.length, staleAtZeroThreshold: freshStrict.staleCount,
    });
    report.analytics_pass = analytics.brands.total > 0 && analytics.pages.total > 0 && analytics.qa.rate >= 0;
    report.freshness_pass = freshAll.rows.length > 0 && freshStrict.staleCount > 0;

    // Final state snapshot
    const state = await withTenant(ctx.tenantId, async (c) => {
      const counts = (await c.query(
        `SELECT deployment_state, indexing_state, count(*) FROM site_pages WHERE brand_id=$1 GROUP BY 1,2 ORDER BY 1,2`, [brandAId])).rows;
      const manifests = (await c.query(`SELECT version, is_live, jsonb_array_length(indexable_paths) AS idx FROM site_manifests WHERE brand_id=$1 ORDER BY version`, [brandAId])).rows;
      const events = (await c.query(`SELECT count(*) AS n FROM publish_events WHERE brand_id=$1`, [brandAId])).rows[0].n;
      return { counts, manifests, events };
    });
    log("final_state_A", state);

    report.ok = true;
    return Response.json(report);
  } catch (e: any) {
    report.ok = false;
    report.error = e?.message;
    report.stack = e?.stack?.split("\n").slice(0, 4);
    return Response.json(report, { status: 500 });
  }
}
