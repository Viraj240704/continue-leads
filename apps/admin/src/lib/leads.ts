import "server-only";
import crypto from "node:crypto";
import { withSystem, withTenant } from "./db";
import { env } from "./env";
import { audit } from "./audit";
import { validateLeadData } from "./validation";

// PII encryption (aes-256-gcm). Key derived from SESSION_SECRET. In prod this key
// lives in Secrets Manager / KMS (spec NFR: "PII encrypted").
const KEY = crypto.scryptSync(env.sessionSecret, "cl-lead-pii", 32);

function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ct]).toString("base64");
}
export function decryptLead(b64: string): string {
  const raw = Buffer.from(b64, "base64");
  const iv = raw.subarray(0, 12), tag = raw.subarray(12, 28), ct = raw.subarray(28);
  const d = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(ct), d.final()]).toString("utf8");
}

// Simple in-memory rate limiter (per IP). Prod uses WAF + a shared store.
const hits = new Map<string, number[]>();
function rateLimited(ip: string, max = 5, windowMs = 10 * 60_000): boolean {
  const now = Date.now();
  const arr = (hits.get(ip) ?? []).filter((t) => now - t < windowMs);
  arr.push(now);
  hits.set(ip, arr);
  return arr.length > max;
}

export interface LeadInput {
  brandSlug: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  consent: boolean;
  honeypot?: string;
  utm: Record<string, string>;
  pagePath?: string;
  ip: string;
  userAgent?: string;
}

export type LeadOutcome = { ok: true; deduped: boolean } | { ok: false; reason: string };

export async function captureLead(input: LeadInput): Promise<LeadOutcome> {
  if (input.honeypot && input.honeypot.trim() !== "") return { ok: false, reason: "spam" };
  if (!input.consent) return { ok: false, reason: "consent_required" };
  if (!input.name?.trim() || !input.phone?.trim()) return { ok: false, reason: "missing_fields" };
  if (rateLimited(input.ip)) return { ok: false, reason: "rate_limited" };

  const brand = await withSystem(async (c) => {
    const { rows } = await c.query(`SELECT id, tenant_id FROM brands WHERE slug = $1 LIMIT 1`, [input.brandSlug]);
    return rows[0];
  });
  if (!brand) return { ok: false, reason: "unknown_brand" };

  const payload = encrypt(JSON.stringify({ name: input.name, phone: input.phone, email: input.email ?? "", message: input.message ?? "" }));
  const dayBucket = new Date().toISOString().slice(0, 10);
  const dedupeKey = crypto.createHash("sha256").update(`${brand.id}|${input.phone}|${dayBucket}`).digest("hex");
  const consent = {
    text: `Contact consent given for ${input.brandSlug}`,
    timestamp: new Date().toISOString(),
    ip: input.ip,
    userAgent: input.userAgent ?? "",
  };

  // Validate + score + price at capture time.
  const v = validateLeadData({ name: input.name, phone: input.phone, email: input.email, message: input.message, utm: input.utm });
  const serviceInterest = serviceFromPath(input.pagePath ?? "");

  return withTenant(brand.tenant_id, async (c) => {
    const res = await c.query(
      `INSERT INTO leads (tenant_id, brand_id, page_path, payload_encrypted, utm, consent, source, dedupe_key,
                          validation_status, validation, quality_score, price_usd, sale_status, service_interest)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
       ON CONFLICT (dedupe_key) DO NOTHING
       RETURNING id`,
      [brand.tenant_id, brand.id, input.pagePath ?? "", payload, input.utm, consent,
       { channel: "web-form", ua: input.userAgent ?? "" }, dedupeKey,
       v.validationStatus, v.validation, v.qualityScore, v.priceUsd,
       v.validationStatus === "valid" ? "for_sale" : "new", serviceInterest]
    );
    const deduped = res.rowCount === 0;
    if (!deduped) {
      await audit(c, { tenantId: brand.tenant_id, brandId: brand.id, eventType: "cost", detail: { lead: true, path: input.pagePath ?? "", validation: v.validationStatus, score: v.qualityScore } });
    }
    return { ok: true as const, deduped };
  });
}

// Infer the service the lead was interested in from the page they submitted on.
function serviceFromPath(path: string): string {
  const m = path.match(/\/services\/([a-z0-9-]+)/);
  return m ? m[1]!.replace(/-/g, " ") : "";
}
