import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "../env";
import { seeded } from "../rng";
import type { ContentProvider, GenerateContext } from "./provider";
import type { Block, GeneratedPage, Usage } from "../types";

// Approximate list prices (USD per 1M tokens) for cost attribution. Confirm current rates.
const PRICES: Record<string, { in: number; out: number }> = {
  "claude-opus-4-8": { in: 15, out: 75 },
  "claude-sonnet-5": { in: 3, out: 15 },
  "claude-haiku-4-5": { in: 1, out: 5 },
};
function priceFor(model: string) {
  const key = Object.keys(PRICES).find((k) => model.startsWith(k));
  return key ? PRICES[key]! : { in: 3, out: 15 };
}

// The JSON contract we ask Claude to return — editorial prose only. Structural
// blocks (lead form, CTA, service grid links, legal, local facts) are assembled
// deterministically around it so links/compliance/forms stay correct.
interface ClaudeDraft {
  metaTitle: string;
  metaDescription: string;
  headline: string;
  subhead: string;
  sections: { heading: string; paragraphs: string[] }[];
  serviceBlurbs?: Record<string, string>;
  faq?: { q: string; a: string }[];
}

let _client: Anthropic | null = null;
function client() {
  return (_client ??= new Anthropic({ apiKey: env.anthropicApiKey }));
}

export class ClaudeContentProvider implements ContentProvider {
  readonly model = env.claudeModel;
  // Used to fall back to deterministic content if the API errors or returns junk.
  constructor(private fallback: ContentProvider) {}

  async generate(ctx: GenerateContext): Promise<{ page: GeneratedPage; usage: Usage }> {
    try {
      return await this.generateReal(ctx);
    } catch (e) {
      console.error("[claude] generation failed, falling back to deterministic:", (e as Error).message);
      return this.fallback.generate(ctx);
    }
  }

  private async generateReal(ctx: GenerateContext): Promise<{ page: GeneratedPage; usage: Usage }> {
    const { pack, brand, page } = ctx;
    const p = brand.profile;
    const city = page.city ?? p.cities[0] ?? p.addressCity;
    const svc = page.service?.name ?? (pack.vocabulary.craft as string) ?? pack.name;
    const services = p.services.map((s) => pack.services.find((x) => x.slug === s)).filter(Boolean);

    const system = [
      `You are the copywriter for "${brand.name}", a ${pack.name} company in ${p.addressCity}.`,
      `Brand voice: ${p.tone}. Adjectives to lean on: ${p.voiceAdjectives.join(", ")}.`,
      `Write specific, genuinely useful local copy — never generic filler or doorway text.`,
      `ALLOWED claims only: ${pack.allowedClaims.join("; ")}.`,
      `NEVER make these prohibited claims: ${pack.prohibitedClaims.join("; ")}. Never fabricate reviews, credentials, or guarantees.`,
      p.tagline ? `Tagline: ${p.tagline}.` : "",
      ctx.brief ? `Brand emphasis: ${ctx.brief}.` : "",
      ctx.aboutText ? `Business background (use for About): ${ctx.aboutText}.` : "",
      `Return ONLY valid minified JSON, no markdown fence, matching:`,
      `{"metaTitle":string,"metaDescription":string,"headline":string,"subhead":string,"sections":[{"heading":string,"paragraphs":[string]}],"serviceBlurbs":{slug:string},"faq":[{"q":string,"a":string}]}`,
    ].filter(Boolean).join("\n");

    const user = [
      `Page type: ${page.type}. Target city: ${city}. Service: ${svc}.`,
      ctx.pageBrief ? `Page-specific emphasis: ${ctx.pageBrief}.` : "",
      `Services offered: ${services.map((s) => `${s!.slug} (${s!.name})`).join(", ")}.`,
      `Service areas: ${p.cities.join(", ") || city}. Years in business: ${p.yearsInBusiness}. License: ${p.licenseRef}.`,
      `Write a distinctive ${page.type} page. 2-4 sections of real, ${city}-specific prose.`,
      page.type === "MONEY" || page.type === "FAQ" ? `Include 3 FAQ items relevant to ${svc} in ${city}.` : "",
      services.length && ["HOME", "CITY"].includes(page.type) ? `Include a one-line serviceBlurb for each service slug.` : "",
      `metaTitle <= 60 chars, metaDescription <= 155 chars.`,
    ].filter(Boolean).join("\n");

    const resp = await client().messages.create({
      model: this.model,
      max_tokens: env.claudeMaxTokens,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = resp.content.filter((c) => c.type === "text").map((c) => (c as any).text).join("");
    const draft = parseJson(text) as ClaudeDraft;

    const page2 = assemble(ctx, draft, city, svc, services as any);
    const pr = priceFor(this.model);
    const usage: Usage = {
      inputTokens: resp.usage.input_tokens,
      outputTokens: resp.usage.output_tokens,
      costUsd: (resp.usage.input_tokens * pr.in + resp.usage.output_tokens * pr.out) / 1_000_000,
    };
    return { page: page2, usage };
  }
}

function parseJson(t: string): unknown {
  let s = t.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) s = fence[1]!.trim();
  const start = s.indexOf("{"), end = s.lastIndexOf("}");
  if (start >= 0 && end > start) s = s.slice(start, end + 1);
  return JSON.parse(s);
}

// Assemble typed blocks from Claude's prose + deterministic scaffolding.
function assemble(ctx: GenerateContext, d: ClaudeDraft, city: string, svc: string, services: { slug: string; name: string }[]): GeneratedPage {
  const { pack, brand, page } = ctx;
  const p = brand.profile;
  const rng = seeded(`${brand.slug}:${page.path}`);
  const heroImg = `hero/${brand.slug}/${rng.pick(pack.imagery.heroThemes)}`.replace(/\s+/g, "-");
  const blocks: Block[] = [];
  const legal = ["PRIVACY", "TERMS", "TCPA"].includes(page.type);

  if (!legal) {
    blocks.push({ type: "hero", eyebrow: page.type === "HOME" ? p.tone : svc, headline: d.headline || `${svc} in ${city}`, subhead: d.subhead || p.tagline, ctaLabel: p.ctaStyle, imageRef: heroImg });
    if (ctx.pageBrief?.trim()) blocks.push({ type: "richText", heading: "Highlights", paragraphs: [ctx.pageBrief.trim()] });
    for (const s of (d.sections ?? []).slice(0, 4)) {
      if (s?.paragraphs?.length) blocks.push({ type: "richText", heading: s.heading ?? "", paragraphs: s.paragraphs });
    }
    if (["HOME", "CITY"].includes(page.type) && services.length) {
      blocks.push({
        type: "serviceGrid", heading: "What we do",
        items: services.map((s) => ({
          title: page.type === "CITY" ? `${s.name} in ${city}` : s.name,
          body: d.serviceBlurbs?.[s.slug] ?? `${s.name} for ${city} homes and businesses.`,
          href: page.type === "CITY" ? `/services/${s.slug}/${citySlug(city)}` : `/services/${s.slug}`,
        })),
      });
    }
    if ((page.type === "MONEY" || page.type === "FAQ") && d.faq?.length) {
      blocks.push({ type: "faq", heading: "Common questions", items: d.faq.slice(0, 6) });
    }
    blocks.push({
      type: "featureList", heading: `Why ${city} chooses ${brand.name}`,
      items: [`${p.yearsInBusiness}+ years serving ${city}`, ...pack.allowedClaims.slice(0, 3)],
    });
    blocks.push({
      type: "localContext", heading: `Serving ${city} and nearby`,
      facts: [
        { label: "Service area", value: p.cities.join(", ") || city },
        { label: "Experience", value: `${p.yearsInBusiness}+ years` },
        { label: "License", value: p.licenseRef },
        { label: "Phone", value: p.phone },
      ],
    });
    if (["HOME", "SERVICE", "MONEY", "CITY", "CONTACT"].includes(page.type)) {
      blocks.push({ type: "leadForm", heading: `Get your free ${city} estimate`, intro: `No obligation. ${brand.name} replies within one business day.` });
    }
    if (["HOME", "SERVICE", "MONEY"].includes(page.type)) {
      blocks.push({ type: "cta", headline: `Ready to start your ${city} ${svc.toLowerCase()} project?`, buttonLabel: p.ctaStyle });
    }
  } else {
    blocks.push({ type: "legal", heading: d.headline || page.title, paragraphs: (d.sections ?? []).flatMap((s) => s.paragraphs) });
  }

  const meaningfulText = blocks
    .filter((b) => b.type === "hero" || b.type === "richText" || b.type === "legal")
    .flatMap((b: any) => b.type === "hero" ? [b.headline, b.subhead] : (b.paragraphs ?? []))
    .join(" ").replace(/\s+/g, " ").trim();

  const metadata = {
    title: (d.metaTitle || `${page.title} | ${brand.name}`).slice(0, 70),
    description: (d.metaDescription || meaningfulText).slice(0, 155),
    canonicalPath: page.path,
  };
  const schemaPayload =
    page.type === "FAQ" || page.type === "MONEY"
      ? { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: (d.faq ?? []).map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) }
      : { "@context": "https://schema.org", "@type": "LocalBusiness", name: brand.name, telephone: p.phone, areaServed: p.cities.length ? p.cities : [city], address: { "@type": "PostalAddress", addressLocality: p.addressCity }, url: `https://${brand.domain}` };

  return { blocks, metadata, schemaPayload, meaningfulText };
}

function citySlug(c: string) { return c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
