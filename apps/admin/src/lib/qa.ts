import "server-only";
import type { Client } from "./db";
import { env } from "./env";
import { getEmbedder, toVectorLiteral } from "./adapters/embeddings";
import type { Block, GeneratedPage, VerticalPackConfig } from "./types";

export type Severity = "blocking" | "warning" | "info";
export interface Finding {
  checkKey: string;
  severity: Severity;
  message: string;
  evidence?: Record<string, unknown>;
}
export interface QaResult {
  status: "pass" | "warn" | "fail";
  findings: Finding[];
  topSimilarity: number | null;
}

interface QaContext {
  tenantId: string;
  pageVersionId: string;
  pageId: string;
  brandId: string;
  pageType: string;
  html: string;
  page: GeneratedPage;
  contentHash: string;
  pack: VerticalPackConfig;
  knownPaths: Set<string>;
}

// Legal / utility pages are boilerplate by nature (privacy, terms, TCPA, contact).
// They still get the exact-duplicate check, but semantic near-duplication is expected
// and must not block — only content pages are subject to the similarity block.
const BOILERPLATE_TYPES = new Set(["PRIVACY", "TERMS", "TCPA", "CONTACT"]);

export async function runQa(c: Client, ctx: QaContext): Promise<QaResult> {
  const findings: Finding[] = [];

  // 1. Exact duplication — same content hash on a DIFFERENT page (not this page's own versions).
  const dup = await c.query(
    `SELECT pv.id, sp.path FROM page_versions pv
       JOIN site_pages sp ON sp.id = pv.page_id
      WHERE pv.content_hash = $1 AND pv.page_id <> $2 LIMIT 1`,
    [ctx.contentHash, ctx.pageId]
  );
  // Cross-brand exact-duplicate: legal boilerplate (privacy/terms/tcpa) is intentionally
  // identical across sites, so exempt it. Content pages must never be byte-identical anywhere.
  if (dup.rows[0] && !BOILERPLATE_TYPES.has(ctx.pageType)) {
    findings.push({
      checkKey: "exact-duplicate",
      severity: "blocking",
      message: `Exact duplicate of an existing page (${dup.rows[0].path}).`,
      evidence: { pageVersionId: dup.rows[0].id },
    });
  }

  // 2. Semantic similarity — nearest neighbor over other pages' embeddings.
  const emb = await getEmbedder().embed(ctx.page.meaningfulText);
  const lit = toVectorLiteral(emb);
  const near = await c.query(
    `SELECT pe.page_version_id, sp.path, (1 - (pe.embedding <=> $1::vector)) AS sim
       FROM page_embeddings pe
       JOIN page_versions pv ON pv.id = pe.page_version_id
       JOIN site_pages sp ON sp.id = pv.page_id
      WHERE sp.brand_id = $3          -- per-SITE doorway check (same brand only)
        AND pv.page_id <> $2          -- exclude all versions of the same page
      ORDER BY pe.embedding <=> $1::vector ASC
      LIMIT 1`,
    [lit, ctx.pageId, ctx.brandId]
  );
  let topSimilarity: number | null = null;
  if (near.rows[0]) {
    const sim = Number(near.rows[0].sim);
    topSimilarity = Math.round(sim * 1000) / 1000;
    const isBoilerplate = BOILERPLATE_TYPES.has(ctx.pageType);
    if (sim >= env.similarityBlock && !isBoilerplate) {
      findings.push({
        checkKey: "semantic-similarity",
        severity: "blocking",
        message: `Semantic similarity ${topSimilarity} ≥ block threshold ${env.similarityBlock} vs ${near.rows[0].path}.`,
        evidence: { against: near.rows[0].path, similarity: topSimilarity },
      });
    } else if (sim >= env.similarityBlock && isBoilerplate) {
      findings.push({
        checkKey: "semantic-similarity",
        severity: "info",
        message: `High similarity ${topSimilarity} on boilerplate page (${ctx.pageType}); not blocking.`,
        evidence: { against: near.rows[0].path, similarity: topSimilarity },
      });
    } else if (sim >= env.similarityWarn) {
      findings.push({
        checkKey: "semantic-similarity",
        severity: "warning",
        message: `Semantic similarity ${topSimilarity} in warn band vs ${near.rows[0].path}; review.`,
        evidence: { against: near.rows[0].path, similarity: topSimilarity },
      });
    }
  }

  // 3. Structure — exactly one H1, minimum content depth.
  const h1s = (ctx.html.match(/<h1[ >]/g) ?? []).length;
  if (h1s !== 1) {
    findings.push({ checkKey: "structure-h1", severity: "blocking", message: `Page must have exactly one <h1> (found ${h1s}).` });
  }
  const wordCount = ctx.page.meaningfulText.split(/\s+/).filter(Boolean).length;
  const legal = ["PRIVACY", "TERMS", "TCPA"].some((t) => ctx.html.includes(`>${titleCase(t)}`));
  if (!legal && wordCount < 60) {
    findings.push({ checkKey: "structure-thin", severity: "blocking", message: `Thin content (${wordCount} words); pages must be materially useful.` });
  }

  // 4. Internal links resolve to known page paths.
  const hrefs = [...ctx.html.matchAll(/href="(\/[^"#?]*)"/g)].map((m) => m[1]!);
  const broken = hrefs.filter((h) => h !== "/" && !ctx.knownPaths.has(h) && !h.startsWith("/services/") && !h.startsWith("/areas/"));
  const brokenReal = broken.filter((h) => !["/privacy", "/terms", "/tcpa-disclosure", "/about", "/faq", "/contact"].includes(h));
  if (brokenReal.length) {
    findings.push({ checkKey: "internal-links", severity: "warning", message: `${brokenReal.length} internal link(s) may not resolve.`, evidence: { links: brokenReal.slice(0, 5) } });
  }

  // 5. Prohibited claims.
  const hay = ctx.page.meaningfulText.toLowerCase();
  for (const raw of ctx.pack.prohibitedClaims) {
    const needle = raw.replace(/\{[^}]+\}/g, "").replace(/\s+/g, " ").trim().toLowerCase();
    if (needle.length > 4 && hay.includes(needle)) {
      findings.push({ checkKey: "prohibited-claim", severity: "blocking", message: `Prohibited claim detected: "${raw}".`, evidence: { match: needle } });
    }
  }

  // 6. Accessibility-lite — hero image alt text present, form labels present.
  if (/<img [^>]*alt=""/.test(ctx.html)) {
    findings.push({ checkKey: "a11y-alt", severity: "warning", message: "Image is missing descriptive alt text." });
  }

  // 7. Schema payload present.
  if (!ctx.html.includes("application/ld+json")) {
    findings.push({ checkKey: "schema", severity: "warning", message: "No structured-data (JSON-LD) payload found." });
  }

  // 8. Page weight budget.
  const kb = Math.round(Buffer.byteLength(ctx.html, "utf8") / 1024);
  if (kb > 250) {
    findings.push({ checkKey: "page-weight", severity: "warning", message: `Page HTML is ${kb}KB (budget 250KB).` });
  }

  const hasBlocking = findings.some((f) => f.severity === "blocking");
  const hasWarning = findings.some((f) => f.severity === "warning");
  const status = hasBlocking ? "fail" : hasWarning ? "warn" : "pass";
  return { status, findings, topSimilarity };
}

function titleCase(t: string) {
  return t.charAt(0) + t.slice(1).toLowerCase();
}

export async function persistQa(c: Client, tenantId: string, pageVersionId: string, result: QaResult) {
  const run = await c.query(
    `INSERT INTO qa_runs (tenant_id, page_version_id, status, summary)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [tenantId, pageVersionId, result.status, { topSimilarity: result.topSimilarity, count: result.findings.length }]
  );
  const runId = run.rows[0].id;
  for (const f of result.findings) {
    await c.query(
      `INSERT INTO qa_findings (tenant_id, qa_run_id, check_key, severity, message, evidence)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [tenantId, runId, f.checkKey, f.severity, f.message, f.evidence ?? {}]
    );
  }
  return runId as string;
}

// Meaningful-body text used for both the exact-dup hash and the embedding.
export function meaningfulHash(text: string): string {
  const norm = text.toLowerCase().replace(/\s+/g, " ").trim();
  // FNV-1a 64-ish via two 32-bit hashes.
  let h1 = 2166136261 >>> 0;
  for (let i = 0; i < norm.length; i++) { h1 ^= norm.charCodeAt(i); h1 = Math.imul(h1, 16777619) >>> 0; }
  let h2 = 2166136261 >>> 0;
  for (let i = norm.length - 1; i >= 0; i--) { h2 ^= norm.charCodeAt(i); h2 = Math.imul(h2, 16777619) >>> 0; }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
