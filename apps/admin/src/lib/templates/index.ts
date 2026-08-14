import type { Block, BrandProfile, GeneratedPage, TemplateFamily } from "../types";
import { env } from "../env";

export const TEMPLATE_VERSION = "v1";

export interface RenderInput {
  family: TemplateFamily;
  brand: { name: string; slug: string; domain: string; profile: BrandProfile; logoDataUri?: string | null };
  page: GeneratedPage;
  indexable: boolean;
  isPreview: boolean;
}

const esc = (s: unknown) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

// SVG placeholder image so pages are self-contained (no external hosts) and each
// brand/theme gets a visibly different hero (spec: no repeated hero across brands).
function heroSvg(ref: string, p: BrandProfile): string {
  const h = [...ref].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
  const angle = h % 360;
  const label = esc(ref.split("/").pop()?.replace(/-/g, " ") ?? "");
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1200 700'>
    <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1' gradientTransform='rotate(${angle} .5 .5)'>
      <stop offset='0' stop-color='${p.palette.primary}'/><stop offset='1' stop-color='${p.palette.accent}'/></linearGradient></defs>
    <rect width='1200' height='700' fill='url(#g)'/>
    <rect width='1200' height='700' fill='${p.palette.text}' opacity='0.06'/>
    <text x='60' y='650' font-family='${esc(p.typography.body)}' font-size='30' fill='#ffffff' opacity='0.85'>${label}</text>
  </svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function blockInner(block: Block, family: TemplateFamily, brandSlug: string, p: BrandProfile): string {
  switch (block.type) {
    case "richText": {
      const b = block as any;
      return `<section class="rt">${b.heading ? `<h2>${esc(b.heading)}</h2>` : ""}${b.paragraphs.map((x: string) => `<p>${esc(x)}</p>`).join("")}</section>`;
    }
    case "serviceGrid": {
      const b = block as any;
      return `<section class="grid"><h2>${esc(b.heading)}</h2><div class="cards">${b.items
        .map((it: any) => `<a class="card" href="${esc(it.href)}"><h3>${esc(it.title)}</h3><p>${esc(it.body)}</p><span class="more">Learn more →</span></a>`)
        .join("")}</div></section>`;
    }
    case "featureList": {
      const b = block as any;
      return `<section class="features"><h2>${esc(b.heading)}</h2><ul>${b.items.map((x: string) => `<li>${esc(x)}</li>`).join("")}</ul></section>`;
    }
    case "faq": {
      const b = block as any;
      return `<section class="faq"><h2>${esc(b.heading)}</h2><dl>${b.items
        .map((it: any) => `<div class="qa"><dt>${esc(it.q)}</dt><dd>${esc(it.a)}</dd></div>`)
        .join("")}</dl></section>`;
    }
    case "cta": {
      const b = block as any;
      return `<section class="cta"><h2>${esc(b.headline)}</h2><a class="btn" href="#lead-form">${esc(b.buttonLabel)}</a></section>`;
    }
    case "localContext": {
      const b = block as any;
      return `<section class="local"><h2>${esc(b.heading)}</h2><div class="facts">${b.facts
        .map((f: any) => `<div class="fact"><span class="k">${esc(f.label)}</span><span class="v">${esc(f.value)}</span></div>`)
        .join("")}</div></section>`;
    }
    case "legal": {
      const b = block as any;
      return `<section class="legal"><h1>${esc(b.heading)}</h1>${b.paragraphs.map((x: string) => `<p>${esc(x)}</p>`).join("")}</section>`;
    }
    case "leadForm": {
      const b = block as any;
      return leadFormHtml(b.heading, b.intro, brandSlug, p);
    }
    default:
      return "";
  }
}

function leadFormHtml(heading: string, intro: string, brandSlug: string, p: BrandProfile): string {
  return `<section class="lead" id="lead-form"><div class="lead-inner">
    <h2>${esc(heading)}</h2><p>${esc(intro)}</p>
    <form class="lead-form" method="post" action="${esc(env.baseUrl)}/api/leads">
      <input type="hidden" name="brand" value="${esc(brandSlug)}"/>
      <input type="text" name="company_website" tabindex="-1" autocomplete="off" class="hp" aria-hidden="true"/>
      <label>Name<input name="name" required autocomplete="name"/></label>
      <label>Phone<input name="phone" type="tel" required autocomplete="tel"/></label>
      <label>Email<input name="email" type="email" autocomplete="email"/></label>
      <label>How can we help?<textarea name="message" rows="3"></textarea></label>
      <label class="consent"><input type="checkbox" name="consent" required/> <span>${esc(tcpaConsent(p))}</span></label>
      <button type="submit" class="btn">${esc(p.ctaStyle)}</button>
      <p class="trust">✓ Licensed &amp; insured&nbsp;&nbsp;·&nbsp;&nbsp;✓ Free estimates&nbsp;&nbsp;·&nbsp;&nbsp;✓ Fast response</p>
    </form>
  </div></section>`;
}
// TCPA consent shown above every submit button. The exact wording MUST come from the
// operator's legal counsel — set profile.tcpaConsent per brand. The string below is a
// template default, not legally-reviewed copy.
function tcpaConsent(p: BrandProfile) {
  return (p as any).tcpaConsent ||
    `By submitting, you agree to be contacted at ${p.phone} by phone, text or email about your request. Consent is not a condition of purchase.`;
}

function heroHtml(block: any, family: TemplateFamily, brandSlug: string, p: BrandProfile): string {
  const img = heroSvg(block.imageRef, p);
  if (family === "aurora") {
    return `<header class="hero"><div class="hero-copy">
      <span class="eyebrow">${esc(block.eyebrow)}</span>
      <h1>${esc(block.headline)}</h1><p>${esc(block.subhead)}</p>
      <a class="btn" href="#lead-form">${esc(block.ctaLabel)}</a></div>
      <div class="hero-media"><img src="${img}" alt="${esc(block.imageRef.split("/").pop())}"/></div></header>`;
  }
  // meridian: image as full-bleed band with overlay copy
  return `<header class="hero" style="--hero:url('${img}')"><div class="hero-scrim"></div>
    <div class="hero-copy"><span class="eyebrow">${esc(block.eyebrow)}</span>
    <h1>${esc(block.headline)}</h1><p>${esc(block.subhead)}</p>
    <a class="btn" href="#lead-form">${esc(block.ctaLabel)}</a></div></header>`;
}

function brandMark(brand: RenderInput["brand"]): string {
  if (brand.logoDataUri) return `<img class="brand-logo" src="${brand.logoDataUri}" alt="${esc(brand.name)}"/>`;
  return esc(brand.name);
}
function shellHeader(family: TemplateFamily, brand: RenderInput["brand"]): string {
  const nav = ["Services", "Areas", "About", "FAQ", "Contact"]
    .map((n) => `<a href="/${n === "Services" ? "services/" : n === "Areas" ? "areas/" : n.toLowerCase()}">${n}</a>`)
    .join("");
  if (family === "aurora") {
    return `<nav class="topnav"><a class="brand" href="/">${brandMark(brand)}</a><div class="links">${nav}</div>
      <a class="btn small" href="#lead-form">${esc(brand.profile.ctaStyle)}</a></nav>`;
  }
  return `<nav class="topnav"><div class="bar"><a class="brand" href="/">${brandMark(brand)}</a>
    <span class="phone">☎ ${esc(brand.profile.phone)}</span></div><div class="links">${nav}</div></nav>`;
}

function shellFooter(brand: RenderInput["brand"]): string {
  const p = brand.profile;
  return `<footer class="site-footer"><div class="cols">
    <div><strong>${esc(brand.name)}</strong><p>${esc(p.tagline)}</p></div>
    <div><span>Serving: ${esc(p.cities.join(", ") || p.addressCity)}</span><br/><span>${esc(p.phone)}</span></div>
    <div><a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · <a href="/tcpa-disclosure">TCPA</a></div>
    </div><small>© ${new Date().getFullYear()} ${esc(brand.name)}. License ${esc(p.licenseRef)}.</small></footer>`;
}

export function renderPageHtml(input: RenderInput): string {
  const { family, brand, page, indexable } = input;
  const p = brand.profile;
  const body = page.blocks
    .map((b) => (b.type === "hero" ? heroHtml(b as any, family, brand.slug, p) : blockInner(b, family, brand.slug, p)))
    .join("\n");

  const robots = indexable ? "index,follow" : "noindex,nofollow";
  const css = family === "aurora" ? auroraCss(p) : meridianCss(p);
  const ga = p.analytics?.ga4 ? `<!-- GA4 ${esc(p.analytics.ga4)} (deferred, non-blocking) -->` : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${esc(page.metadata.title)}</title>
<meta name="description" content="${esc(page.metadata.description)}"/>
<meta name="robots" content="${robots}"/>
<link rel="canonical" href="https://${esc(brand.domain)}${esc(page.metadata.canonicalPath)}"/>
<meta property="og:title" content="${esc(page.metadata.title)}"/>
<meta name="template-family" content="${esc(family)}"/>
<script type="application/ld+json">${JSON.stringify(page.schemaPayload)}</script>
<style>${css}</style>
${ga}
</head>
<body class="fam-${esc(family)}">
${shellHeader(family, brand)}
<main>${body}</main>
${shellFooter(brand)}
</body>
</html>`;
}

// --------------------------- Template family CSS ---------------------------
// Two MATERIALLY different families (not a palette swap): different layout system,
// hero treatment, card style, type scale, nav and footer rhythm.

function auroraCss(p: BrandProfile): string {
  return `
  :root{--bg:${p.palette.bg};--sf:${p.palette.surface};--tx:${p.palette.text};--pr:${p.palette.primary};--ac:${p.palette.accent}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:${p.typography.body};line-height:1.6}
  h1,h2,h3{font-family:${p.typography.heading};letter-spacing:-.02em;line-height:1.1}
  a{color:var(--pr);text-decoration:none}main{max-width:1080px;margin:0 auto;padding:0 20px}
  .topnav{display:flex;align-items:center;gap:24px;max-width:1080px;margin:0 auto;padding:22px 20px;justify-content:center;position:relative}
  .topnav .brand{font-family:${p.typography.heading};font-weight:800;font-size:22px;color:var(--tx)}
  .brand-logo{height:36px;width:auto;display:block}
  .topnav .links{display:flex;gap:18px}.topnav .links a{color:var(--tx);opacity:.75;font-size:14px}
  .topnav .btn.small{position:absolute;right:20px}
  .btn{display:inline-block;background:var(--pr);color:#fff;padding:14px 26px;border-radius:999px;font-weight:600;border:none;cursor:pointer}
  .btn.small{padding:9px 16px;font-size:13px}
  .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:40px;align-items:center;max-width:1080px;margin:20px auto;padding:40px 20px}
  .hero h1{font-size:52px;margin:.2em 0}.hero p{font-size:19px;opacity:.85}
  .eyebrow{text-transform:capitalize;color:var(--pr);font-weight:700;font-size:14px}
  .hero-media img{width:100%;border-radius:24px;box-shadow:0 30px 60px rgba(0,0,0,.18)}
  section{margin:56px auto;max-width:1080px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px}
  .card{background:var(--sf);border-radius:20px;padding:26px;display:block;color:var(--tx);box-shadow:0 8px 24px rgba(0,0,0,.06);transition:transform .15s}
  .card:hover{transform:translateY(-4px)}.card h3{margin:.1em 0}.card .more{color:var(--pr);font-weight:600;font-size:14px}
  .features ul{columns:2;gap:30px;list-style:none;padding:0}.features li{background:var(--sf);margin:0 0 12px;padding:14px 18px;border-radius:14px}
  .faq .qa{border-bottom:1px solid rgba(0,0,0,.08);padding:16px 0}.faq dt{font-weight:700}.faq dd{margin:6px 0 0;opacity:.85}
  .cta{background:linear-gradient(120deg,var(--pr),var(--ac));color:#fff;border-radius:28px;padding:48px;text-align:center}
  .cta .btn{background:#fff;color:var(--pr);margin-top:10px}
  .local .facts{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:14px}
  .fact{background:var(--sf);border-radius:14px;padding:16px}.fact .k{display:block;font-size:12px;text-transform:uppercase;opacity:.6}.fact .v{font-weight:600}
  .lead{background:var(--sf);border-radius:28px;padding:8px}.lead-inner{max-width:560px;margin:0 auto;padding:32px}
  .lead-form{display:grid;gap:12px}.lead-form label{display:grid;gap:6px;font-size:14px;font-weight:600}
  .lead-form input,.lead-form textarea{padding:12px;border:1px solid rgba(0,0,0,.15);border-radius:12px;font:inherit}
  .lead-form .consent{grid-template-columns:auto 1fr;display:grid;align-items:start;font-weight:400;font-size:12px}
.trust{margin:10px 0 0;font-size:12px;text-align:center;opacity:.75}
  .hp{position:absolute;left:-9999px}.legal{max-width:760px}
  .site-footer{margin-top:80px;background:var(--tx);color:#fff;padding:40px 20px}
  .site-footer .cols{max-width:1080px;margin:0 auto;display:grid;grid-template-columns:repeat(3,1fr);gap:24px}
  .site-footer a{color:#fff;opacity:.85}.site-footer small{display:block;max-width:1080px;margin:20px auto 0;opacity:.6}
  @media(max-width:820px){.hero{grid-template-columns:1fr}.hero h1{font-size:38px}.features ul{columns:1}.site-footer .cols{grid-template-columns:1fr}.topnav{flex-wrap:wrap}.topnav .btn.small{position:static}}
  `;
}

function meridianCss(p: BrandProfile): string {
  return `
  :root{--bg:${p.palette.bg};--sf:${p.palette.surface};--tx:${p.palette.text};--pr:${p.palette.primary};--ac:${p.palette.accent}}
  *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--tx);font-family:${p.typography.body};line-height:1.65}
  h1,h2,h3{font-family:${p.typography.heading};text-transform:none;line-height:1.15}
  a{color:var(--pr);text-decoration:none}main{max-width:1180px;margin:0 auto;padding:0 28px}
  .topnav{border-bottom:3px solid var(--pr);background:var(--sf)}
  .topnav .bar{display:flex;justify-content:space-between;align-items:center;max-width:1180px;margin:0 auto;padding:14px 28px}
  .topnav .brand{font-family:${p.typography.heading};font-weight:800;font-size:20px;text-transform:uppercase;letter-spacing:.06em;color:var(--tx)}
  .brand-logo{height:34px;width:auto;display:block}
  .topnav .phone{font-weight:700;color:var(--pr)}
  .topnav .links{display:flex;gap:26px;max-width:1180px;margin:0 auto;padding:10px 28px}
  .topnav .links a{color:var(--tx);text-transform:uppercase;font-size:12px;letter-spacing:.08em;font-weight:600}
  .btn{display:inline-block;background:var(--pr);color:#fff;padding:15px 30px;border-radius:2px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;border:none;cursor:pointer}
  .hero{position:relative;min-height:520px;display:flex;align-items:flex-end;background-image:var(--hero);background-size:cover;background-position:center;color:#fff}
  .hero-scrim{position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.15))}
  .hero-copy{position:relative;max-width:1180px;margin:0 auto;padding:60px 28px;width:100%}
  .hero h1{font-size:56px;max-width:16ch;margin:.15em 0}.hero p{font-size:20px;max-width:60ch;opacity:.95}
  .eyebrow{text-transform:uppercase;letter-spacing:.18em;font-size:13px;font-weight:700;color:#fff;border-left:4px solid var(--ac);padding-left:10px}
  section{margin:64px auto;max-width:1180px}
  .rt,.legal{max-width:760px}
  .cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;border-top:2px solid var(--tx)}
  .card{border-bottom:2px solid var(--tx);border-right:2px solid var(--tx);padding:28px;display:block;color:var(--tx)}
  .card:hover{background:var(--sf)}.card h3{margin:0 0 8px;text-transform:none}.card .more{color:var(--pr);font-weight:700;text-transform:uppercase;font-size:12px}
  .features ul{list-style:none;padding:0;display:grid;grid-template-columns:1fr 1fr;gap:0}
  .features li{border:1px solid var(--tx);margin:-1px 0 0 -1px;padding:18px 20px}
  .features li::before{content:"▸ ";color:var(--pr);font-weight:800}
  .faq .qa{padding:20px 0;border-bottom:2px solid var(--tx)}.faq dt{font-weight:800;text-transform:uppercase;font-size:15px;letter-spacing:.02em}.faq dd{margin:8px 0 0}
  .cta{background:var(--tx);color:#fff;padding:64px 28px;text-align:left}.cta h2{font-size:34px;max-width:20ch}.cta .btn{background:var(--ac);margin-top:16px}
  .local{background:var(--sf);padding:36px 28px}.local .facts{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border-left:2px solid var(--tx)}
  .fact{border-right:2px solid var(--tx);border-top:2px solid var(--tx);border-bottom:2px solid var(--tx);padding:18px}
  .fact .k{display:block;text-transform:uppercase;font-size:11px;letter-spacing:.1em;color:var(--pr);font-weight:700}.fact .v{font-weight:700}
  .lead{background:var(--tx);color:#fff}.lead-inner{max-width:640px;margin:0 auto;padding:48px 28px}
  .lead h2{color:#fff}.lead-form{display:grid;gap:14px}.lead-form label{display:grid;gap:6px;font-size:12px;text-transform:uppercase;letter-spacing:.06em;font-weight:700}
  .lead-form input,.lead-form textarea{padding:13px;border:2px solid #fff;background:transparent;color:#fff;border-radius:0;font:inherit}
  .lead-form .consent{grid-template-columns:auto 1fr;display:grid;gap:8px;text-transform:none;letter-spacing:0;font-weight:400;font-size:12px}
  .hp{position:absolute;left:-9999px}
  .site-footer{margin-top:80px;border-top:3px solid var(--pr);background:var(--sf);padding:44px 28px}
  .site-footer .cols{max-width:1180px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:24px}
  .site-footer small{display:block;max-width:1180px;margin:20px auto 0;opacity:.6}
  @media(max-width:820px){.hero h1{font-size:36px}.features ul{grid-template-columns:1fr}.local .facts{grid-template-columns:1fr 1fr}.site-footer .cols{grid-template-columns:1fr}.topnav .links{flex-wrap:wrap;gap:14px}}
  `;
}
