import "server-only";
import { seeded } from "../rng";
import { env } from "../env";
import { ClaudeContentProvider } from "./claude";
import {
  OPENERS, APPROACH, LOCAL, OUTCOME, SERVICE_BODY, HEADLINES,
  compose, composeList, fill,
} from "./contentbank";
import type {
  Block, GeneratedPage, PackService, PageType, Usage,
  VerticalPackConfig, BrandProfile,
} from "../types";

export interface GenerateContext {
  pack: VerticalPackConfig;
  brand: { slug: string; name: string; domain: string; profile: BrandProfile };
  page: {
    type: PageType;
    path: string;
    title: string;
    service?: PackService;
    city?: string;
  };
  brief?: string;      // brand-level free-text instructions/emphasis
  pageBrief?: string;  // per-page brief override (unique per page)
  aboutText?: string;  // operator-supplied about-us / document text
  promptVersion: string;
}

export interface ContentProvider {
  readonly model: string;
  generate(ctx: GenerateContext): Promise<{ page: GeneratedPage; usage: Usage }>;
}

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// ---------------------------------------------------------------------------
// MockClaudeProvider — deterministic composition. Distinction comes from
// structured pack + brand inputs and a reproducible per-page seed drawing from a
// large phrase bank (spec §4), NOT prompt randomness. Swap in a real Claude
// adapter behind the same interface.
// ---------------------------------------------------------------------------
class MockClaudeProvider implements ContentProvider {
  readonly model = "mock-claude-3";

  async generate(ctx: GenerateContext) {
    const { pack, brand, page } = ctx;
    const p = brand.profile;
    const rng = seeded(`${brand.slug}:${page.path}:${ctx.promptVersion}`);
    const vocab = pack.vocabulary as Record<string, string | string[]>;
    const actor = (vocab.actor as string) ?? "team";
    const craft = (vocab.craft as string) ?? "service";
    const cities = p.cities.length ? p.cities : [p.addressCity];
    const primaryCity = page.city ?? cities[0] ?? p.addressCity;

    const advPool = p.voiceAdjectives.length ? p.voiceAdjectives : ["reliable", "careful"];
    const [adj, adj2] = rng.shuffle(advPool);

    const svcName = page.service?.name ?? cap(craft);
    const svcLower = (page.service?.name ?? craft).toLowerCase();
    const vars = {
      brand: brand.name, service: svcName, svc: svcLower, city: primaryCity,
      actor, craft, craftCap: cap(craft), adj: adj ?? "reliable", adj2: adj2 ?? "careful",
      adjCap: cap(adj ?? "reliable"), years: String(p.yearsInBusiness),
    };

    const blocks: Block[] = [];
    const add = (b: Block) => blocks.push(b);
    const heroImg = `hero/${brand.slug}/${rng.pick(pack.imagery.heroThemes)}`.replace(/\s+/g, "-");
    const hero = (type: keyof typeof HEADLINES, eyebrow: string, subhead: string) =>
      add({ type: "hero", eyebrow, headline: fill(rng.pick(HEADLINES[type]), vars), subhead, ctaLabel: p.ctaStyle, imageRef: heroImg });
    const rich = (heading: string, paragraphs: string[]) => add({ type: "richText", heading, paragraphs });
    const grid = (heading: string, slugs: string[], hrefFor: (s: PackService) => string) =>
      add({
        type: "serviceGrid", heading,
        items: slugs.map((slug) => {
          const s = pack.services.find((x) => x.slug === slug);
          return { title: s?.name ?? slug, body: compose(seeded(`${brand.slug}:${page.path}:${slug}`), SERVICE_BODY, { ...vars, service: s?.name ?? slug, svc: (s?.name ?? slug).toLowerCase() }, 2), href: s ? hrefFor(s) : "#" };
        }),
      });
    const features = () => add({
      type: "featureList", heading: `Why ${primaryCity} chooses ${brand.name}`,
      items: [`${p.yearsInBusiness}+ years serving ${primaryCity} and nearby communities`, ...pack.allowedClaims.slice(0, 3)],
    });
    const local = () => add({
      type: "localContext", heading: `Serving ${primaryCity} and nearby`,
      facts: [
        { label: "Service area", value: p.cities.join(", ") || primaryCity },
        { label: "Experience", value: `${p.yearsInBusiness}+ years` },
        { label: "License", value: p.licenseRef },
        { label: "Phone", value: p.phone },
      ],
    });
    const cta = (headline: string) => add({ type: "cta", headline, buttonLabel: p.ctaStyle });
    const form = () => add({ type: "leadForm", heading: `Get your free ${primaryCity} estimate`, intro: `No obligation. ${brand.name} replies within one business day.` });
    const faqBlock = () => add({
      type: "faq", heading: "Common questions",
      items: pack.faq.map((f) => ({ q: fill(f.q, { service: svcName, city: primaryCity }), a: fill(f.a, { service: svcName, city: primaryCity }) })),
    });

    switch (page.type) {
      case "HOME":
        hero("HOME", p.tone, `${compose(rng, OPENERS, vars, 1)} ${compose(rng, OUTCOME, vars, 1)}`);
        rich(`${adj2 ? cap(adj2) : "Trusted"} ${craft} for ${primaryCity}`, [compose(rng, APPROACH, vars, 2), compose(rng, LOCAL, vars, 2)]);
        if (ctx.brief?.trim()) rich("What sets us apart", [ctx.brief.trim()]);
        grid("What we do", p.services, (s) => `/services/${s.slug}`);
        features(); local();
        cta(`Ready to start your ${primaryCity} project?`); form();
        break;
      case "SERVICE":
        hero("SERVICE", pack.name, compose(rng, OPENERS, vars, 1));
        rich(`Our ${svcLower} approach in ${primaryCity}`, [compose(rng, APPROACH, vars, 2), compose(rng, OUTCOME, vars, 1)]);
        features();
        cta(`Get a free ${svcLower} estimate`); form();
        break;
      case "CITY":
        hero("CITY", "Service area", compose(rng, OPENERS, vars, 1));
        rich(`Local ${craft} in ${primaryCity}`, [compose(rng, LOCAL, vars, 2), compose(rng, APPROACH, vars, 1)]);
        grid(`Popular services in ${primaryCity}`, p.services.slice(0, 4), (s) => `/services/${s.slug}/${citySlug(primaryCity)}`);
        local(); form();
        break;
      case "MONEY":
        hero("MONEY", `${primaryCity} • ${svcName}`, compose(rng, OPENERS, vars, 1));
        rich(`${svcName} for ${primaryCity} properties`, [compose(rng, APPROACH, vars, 2), compose(rng, OUTCOME, vars, 1), compose(rng, LOCAL, vars, 1)]);
        faqBlock();
        cta(`Book your ${primaryCity} ${svcLower} estimate`); form();
        break;
      case "FAQ":
        hero("CITY", "FAQ", `${compose(rng, OPENERS, vars, 1)} ${compose(rng, OUTCOME, vars, 1)}`);
        rich(`Common ${craft} questions in ${primaryCity}`, [compose(rng, APPROACH, vars, 1), compose(rng, LOCAL, vars, 1)]);
        faqBlock();
        break;
      case "BLOG_INDEX":
        hero("CITY", "Blog", `${craft} tips, guides and local advice for ${primaryCity} homeowners.`);
        rich(`From the ${brand.name} team`, [compose(rng, LOCAL, vars, 1), compose(rng, APPROACH, vars, 1)]);
        break;
      case "BLOG_POST":
        hero("MONEY", "Guide", compose(rng, OPENERS, vars, 1));
        rich(page.title || `${craft} guide for ${primaryCity}`, [compose(rng, APPROACH, vars, 2), compose(rng, OUTCOME, vars, 1), compose(rng, LOCAL, vars, 1)]);
        faqBlock();
        break;
      case "ABOUT": {
        hero("CITY", "About us", p.tagline);
        const story = ctx.aboutText?.trim()
          ? ctx.aboutText.trim().split(/\n{2,}/).map((s) => s.trim()).filter(Boolean).slice(0, 4)
          : [
              `${brand.name} is a ${adj} ${actor} company based in ${p.addressCity}. ${compose(rng, LOCAL, vars, 1)}`,
              `${compose(rng, APPROACH, vars, 1)} We are licensed and insured (${p.licenseRef}).`,
            ];
        if (ctx.brief?.trim()) story.push(ctx.brief.trim());
        rich("Our story", story);
        local();
        break;
      }
      case "CONTACT":
        hero("CITY", "Contact", `Call ${p.phone} or request a free estimate below.`);
        form(); local();
        break;
      case "PRIVACY": add({ type: "legal", heading: "Privacy Policy", paragraphs: privacyText(brand.name) }); break;
      case "TERMS": add({ type: "legal", heading: "Terms of Service", paragraphs: termsText(brand.name) }); break;
      case "TCPA": add({ type: "legal", heading: "TCPA Consent & Disclosure", paragraphs: tcpaText(brand.name, p.phone) }); break;
    }

    // Per-page brief is unique to this page, so inject it high as an emphasis block
    // on any non-legal page (safe for the similarity gate).
    const pageBrief = ctx.pageBrief?.trim();
    if (pageBrief && !["PRIVACY", "TERMS", "TCPA"].includes(page.type)) {
      const at = blocks.findIndex((b) => b.type === "hero") + 1;
      blocks.splice(Math.max(1, at), 0, { type: "richText", heading: "Highlights", paragraphs: [pageBrief] });
    }

    const meaningfulText = extractBlockText(blocks);
    const metadata = {
      title: `${page.title} | ${brand.name}`,
      description: truncate(meaningfulText || `${brand.name} — ${pack.name} in ${primaryCity}.`, 155),
      canonicalPath: page.path,
    };
    const schemaPayload = buildSchema(page.type, brand, p, primaryCity, pack);

    const outputTokens = Math.max(120, Math.round(meaningfulText.length / 4));
    const inputTokens = 380 + blocks.length * 40;
    const usage: Usage = { inputTokens, outputTokens, costUsd: (inputTokens * 3 + outputTokens * 15) / 1_000_000 };

    return { page: { blocks, metadata, schemaPayload, meaningfulText }, usage };
  }
}

// The "meaningful body" (spec §7 page_embeddings): genuinely page-specific editorial
// prose only. Shared components (service grid chrome, standard claims, facts block,
// reused FAQ, CTA/form) are excluded so similarity reflects real content overlap.
function extractBlockText(blocks: Block[]): string {
  const out: string[] = [];
  for (const b of blocks as any[]) {
    if (b.type === "hero") out.push(b.headline, b.subhead);
    else if (b.type === "richText") out.push(b.heading ?? "", ...(b.paragraphs ?? []));
    else if (b.type === "legal") out.push(b.heading, ...b.paragraphs);
  }
  return out.join(" ").replace(/\s+/g, " ").trim();
}

function citySlug(c: string) { return c.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
function truncate(s: string, n: number) { return s.length <= n ? s : s.slice(0, n - 1).trimEnd() + "…"; }

function buildSchema(type: PageType, brand: { name: string; domain: string }, p: BrandProfile, city: string, pack: VerticalPackConfig) {
  if (type === "FAQ" || type === "MONEY") {
    return {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: pack.faq.map((f) => ({
        "@type": "Question", name: fill(f.q, { service: pack.name, city }),
        acceptedAnswer: { "@type": "Answer", text: fill(f.a, { service: pack.name, city }) },
      })),
    };
  }
  return {
    "@context": "https://schema.org", "@type": "LocalBusiness", name: brand.name,
    telephone: p.phone, areaServed: p.cities.length ? p.cities : [city],
    address: { "@type": "PostalAddress", addressLocality: p.addressCity }, url: `https://${brand.domain}`,
  };
}

function privacyText(name: string) {
  return [
    `${name} respects your privacy. This policy explains what information we collect when you request an estimate and how we use it.`,
    `We collect the contact details and project information you submit. We use them only to respond to your request and provide services. We do not sell your personal information.`,
    `You may request deletion of your information at any time by contacting us.`,
  ];
}
function termsText(name: string) {
  return [
    `These terms govern your use of the ${name} website. By using this site you agree to them.`,
    `Estimates are provided for informational purposes and are not a binding contract until a written agreement is signed.`,
    `All content on this site is provided in good faith and may be updated without notice.`,
  ];
}
function tcpaText(name: string, phone: string) {
  return [
    `By submitting a request on this site, you consent to be contacted by ${name} at the phone number and email you provide, including by phone call, text message and email, regarding your inquiry.`,
    `Consent is not a condition of purchase. Message and data rates may apply. You may opt out at any time by replying STOP or by calling ${phone}.`,
    `We capture the consent text, source page and timestamp of each submission. This language must be reviewed by counsel before public launch.`,
  ];
}

export function getContentProvider(): ContentProvider {
  const mock = new MockClaudeProvider();
  if (env.contentProvider === "claude") {
    if (!env.anthropicApiKey) {
      console.warn("CONTENT_PROVIDER=claude but ANTHROPIC_API_KEY is empty; using deterministic mock.");
      return mock;
    }
    return new ClaudeContentProvider(mock); // mock is the graceful fallback
  }
  return mock;
}
