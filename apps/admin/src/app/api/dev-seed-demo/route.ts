import { NextRequest } from "next/server";
import { withSystem, withTenant } from "@/lib/db";
import { listPacks } from "@/lib/packs";
import { createBrandWithPlan } from "@/lib/sites";
import { generatePages } from "@/lib/jobs";
import { approveAllEligible } from "@/lib/approvals";
import { buildSchedule } from "@/lib/scheduler";
import { publishDue } from "@/lib/publisher";
import { DESIGN_PRESETS } from "@/lib/presets";
import type { BrandProfile } from "@/lib/types";

// DEV-ONLY: populate the dashboard with three fully-built demo sites — two painting
// brands (must be distinct) plus one roofing brand — matching the pilot acceptance
// shape. Idempotent: skips brands that already exist. Disabled in production.
export async function POST(_req: NextRequest) {
  if (process.env.NODE_ENV === "production") return new Response("disabled", { status: 403 });

  const ctx = await withSystem(async (c) => {
    const u = (await c.query(`SELECT id, tenant_id FROM users WHERE role='operator' LIMIT 1`)).rows[0];
    return { tenantId: u.tenant_id as string, userId: u.id as string };
  });
  const packs = await withTenant(ctx.tenantId, (c) => listPacks(c));
  const painting = packs.find((p) => p.key === "painting")!;
  const roofing = packs.find((p) => p.key === "roofing")!;

  const preset = (id: string) => DESIGN_PRESETS.find((p) => p.id === id)!;
  function profile(pr: ReturnType<typeof preset>, phone: string, city: string, services: string[], cities: string[], years: number, tagline: string): BrandProfile {
    return {
      tagline, tone: pr.tone, voiceAdjectives: pr.voiceAdjectives, ctaStyle: pr.ctaStyle,
      palette: pr.palette, typography: pr.typography, phone, email: "hello@example.test",
      addressCity: city, yearsInBusiness: years, licenseRef: `Lic #${Math.floor(Math.random() * 90000 + 10000)}`,
      services, cities, analytics: {},
    };
  }

  const specs = [
    {
      name: "Copperline Painting Co", slug: "copperline-painting", domain: "copperlinepainting.com",
      pack: painting, preset: preset("aurora-warm"),
      profile: profile(preset("aurora-warm"), "(512) 555-0142", "Austin", ["interior-painting", "exterior-painting", "cabinet-refinishing"], ["Austin", "Round Rock"], 14, "Hand-finished detail on every wall we touch."),
    },
    {
      name: "Slate & Brush Painters", slug: "slate-brush-painters", domain: "slateandbrush.com",
      pack: painting, preset: preset("meridian-bold"),
      profile: profile(preset("meridian-bold"), "(303) 555-0188", "Denver", ["interior-painting", "commercial-painting", "exterior-painting"], ["Denver", "Boulder"], 9, "Precise commercial and residential coatings, on schedule."),
    },
    {
      name: "Summit Ridge Roofing", slug: "summit-ridge-roofing", domain: "summitridgeroofing.com",
      pack: roofing, preset: preset("meridian-heritage"),
      profile: profile(preset("meridian-heritage"), "(720) 555-0119", "Denver", ["roof-replacement", "roof-repair", "storm-damage"], ["Denver", "Aurora"], 21, "Storm-ready roofs backed by decades in the Front Range."),
    },
  ];

  const out: any[] = [];
  for (const s of specs) {
    const exists = await withSystem(async (c) => (await c.query(`SELECT 1 FROM brands WHERE slug=$1`, [s.slug])).rowCount);
    if (exists) { out.push({ slug: s.slug, skipped: true }); continue; }

    const brandId = await withTenant(ctx.tenantId, (c) => createBrandWithPlan(c, ctx.tenantId, ctx.userId, {
      name: s.name, slug: s.slug, domain: s.domain, verticalPackId: s.pack.id,
      templateFamily: s.preset.templateFamily, profile: s.profile,
      rollout: { launchSize: 8, weeklyTargets: [6, 8, 12, 17], dailyCap: 3, timezone: "America/Denver" },
    }));
    const gen = await withTenant(ctx.tenantId, (c) => generatePages(c, { tenantId: ctx.tenantId, brandId, actorUserId: ctx.userId }));
    await withTenant(ctx.tenantId, (c) => approveAllEligible(c, { tenantId: ctx.tenantId, brandId, reviewerUserId: ctx.userId }));
    await withTenant(ctx.tenantId, (c) => buildSchedule(c, { tenantId: ctx.tenantId, brandId, actorUserId: ctx.userId }));
    const pub = await withTenant(ctx.tenantId, (c) => publishDue(c, { tenantId: ctx.tenantId, brandId, actorUserId: ctx.userId }));
    out.push({ slug: s.slug, brandId, generated: gen.generated, qaPass: gen.qaPass, qaFail: gen.qaFail, published: pub.published, indexable: pub.manifestVersion });
  }
  return Response.json({ ok: true, brands: out });
}
