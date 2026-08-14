import "server-only";
import crypto from "node:crypto";
import type { Client } from "./db";
import { withSystem } from "./db";
import { decryptLead } from "./leads";
import { validateLeadData } from "./validation";
import { audit } from "./audit";

export interface LeadListItem {
  id: string;
  brand_id: string;
  brand_name: string;
  service_interest: string;
  page_path: string;
  city: string;
  created_at: string;
  validation_status: string;
  quality_score: number;
  price_usd: number;
  sale_status: string;
  buyer: string;
  buyerName: string;
  contactMasked: { name: string; phone: string; email: string };
}

function decodePayload(enc: string): { name: string; phone: string; email: string; message: string } {
  try { return JSON.parse(decryptLead(enc)); } catch { return { name: "", phone: "", email: "", message: "" }; }
}
function mask(p: { name: string; phone: string; email: string }) {
  const parts = p.name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "";
  const lastInitial = parts[1] ? ` ${parts[1][0]}.` : "";
  const name = first ? first + lastInitial : "—";
  const digits = (p.phone.match(/\d/g) ?? []).join("");
  const phone = digits ? `•••-•••-${digits.slice(-4)}` : "—";
  const email = p.email ? `${p.email[0]}•••@${p.email.split("@")[1] ?? ""}` : "—";
  return { name, phone, email };
}

export async function listLeads(c: Client, opts: { brandId?: string; saleStatus?: string; buyerId?: string } = {}): Promise<LeadListItem[]> {
  const where: string[] = [];
  const args: any[] = [];
  if (opts.brandId) { args.push(opts.brandId); where.push(`l.brand_id = $${args.length}`); }
  if (opts.saleStatus) { args.push(opts.saleStatus); where.push(`l.sale_status = $${args.length}`); }
  if (opts.buyerId) { args.push(opts.buyerId); where.push(`l.buyer_id = $${args.length}`); }
  const sql = `
    SELECT l.*, b.name AS brand_name, by.name AS buyer_name
      FROM leads l JOIN brands b ON b.id = l.brand_id
      LEFT JOIN buyers by ON by.id = l.buyer_id
     ${where.length ? "WHERE " + where.join(" AND ") : ""}
     ORDER BY l.created_at DESC LIMIT 500`;
  const { rows } = await c.query(sql, args);
  return rows.map((r) => {
    const p = decodePayload(r.payload_encrypted);
    return {
      id: r.id, brand_id: r.brand_id, brand_name: r.brand_name, service_interest: r.service_interest,
      page_path: r.page_path, city: r.consent?.city ?? "", created_at: r.created_at,
      validation_status: r.validation_status, quality_score: r.quality_score, price_usd: Number(r.price_usd),
      sale_status: r.sale_status, buyer: r.buyer, buyerName: r.buyer_name ?? r.buyer ?? "", contactMasked: mask(p),
    } as LeadListItem;
  });
}

export async function getLeadFull(c: Client, leadId: string) {
  const { rows } = await c.query(
    `SELECT l.*, b.name AS brand_name, b.slug AS brand_slug,
            by.name AS buyer_name, by.company AS buyer_company, by.access_token AS buyer_token
       FROM leads l JOIN brands b ON b.id = l.brand_id
       LEFT JOIN buyers by ON by.id = l.buyer_id
      WHERE l.id = $1`,
    [leadId]
  );
  const r = rows[0];
  if (!r) return null;
  const contact = decodePayload(r.payload_encrypted);
  return {
    id: r.id, brandId: r.brand_id, brandName: r.brand_name, brandSlug: r.brand_slug,
    pagePath: r.page_path, serviceInterest: r.service_interest, createdAt: r.created_at,
    utm: r.utm, consent: r.consent, source: r.source,
    validationStatus: r.validation_status, validation: r.validation, qualityScore: r.quality_score,
    priceUsd: Number(r.price_usd), saleStatus: r.sale_status, buyer: r.buyer, soldAt: r.sold_at,
    returnedAt: r.returned_at as string | null, rejectedAt: r.rejected_at as string | null, returnReason: r.return_reason as string | null,
    deliveryToken: r.delivery_token as string | null, deliveredAt: r.delivered_at,
    buyerId: r.buyer_id as string | null, buyerName: r.buyer_name as string | null,
    buyerCompany: r.buyer_company as string | null, buyerToken: r.buyer_token as string | null,
    contact, // full decrypted PII — shown only on the detail view
  };
}

export async function revalidateLead(c: Client, leadId: string) {
  const { rows } = await c.query(`SELECT payload_encrypted, utm FROM leads WHERE id = $1`, [leadId]);
  if (!rows[0]) return null;
  const p = decodePayload(rows[0].payload_encrypted);
  const v = validateLeadData({ name: p.name, phone: p.phone, email: p.email, message: p.message, utm: rows[0].utm });
  await c.query(
    `UPDATE leads SET validation_status=$1, validation=$2, quality_score=$3, price_usd=$4,
        sale_status = CASE WHEN sale_status='sold' THEN 'sold'
                           WHEN $1='valid' THEN 'for_sale'
                           WHEN $1='invalid' THEN 'rejected' ELSE 'new' END
      WHERE id=$5`,
    [v.validationStatus, v.validation, v.qualityScore, v.priceUsd, leadId]
  );
  return v;
}

export async function markLeadSold(
  c: Client,
  opts: { tenantId: string; leadId: string; buyer: string; buyerId?: string | null; actorUserId: string }
): Promise<{ ok: boolean; reason?: string; deliveryToken?: string }> {
  const { rows } = await c.query(`SELECT brand_id, validation_status, sale_status, price_usd, delivery_token FROM leads WHERE id = $1`, [opts.leadId]);
  const l = rows[0];
  if (!l) return { ok: false, reason: "Lead not found" };
  if (l.validation_status === "invalid") return { ok: false, reason: "Cannot sell an invalid lead" };
  if (l.sale_status === "sold") return { ok: false, reason: "Lead already sold" };
  // Gate A: only sell to an onboarded + approved buyer.
  if (!opts.buyerId) return { ok: false, reason: "Select an approved buyer" };
  const buyer = (await c.query(`SELECT approval_status FROM buyers WHERE id=$1`, [opts.buyerId])).rows[0];
  if (!buyer) return { ok: false, reason: "Buyer not found" };
  if (buyer.approval_status !== "approved") return { ok: false, reason: "Buyer is not approved (complete onboarding first)" };
  const token = (l.delivery_token as string) || crypto.randomBytes(24).toString("hex");
  await c.query(`UPDATE leads SET sale_status='sold', buyer=$1, buyer_id=$2, sold_at=now(), delivery_token=$3 WHERE id=$4`,
    [opts.buyer || "buyer", opts.buyerId ?? null, token, opts.leadId]);
  await audit(c, { tenantId: opts.tenantId, brandId: l.brand_id, eventType: "cost", actorUserId: opts.actorUserId, detail: { leadSold: opts.leadId, buyer: opts.buyer, priceUsd: Number(l.price_usd) } });
  return { ok: true, deliveryToken: token };
}

// Public buyer-facing delivery: fetch the sold lead by its unguessable token and
// record first delivery. No tenant scope — the token IS the authorization.
export async function getLeadByDeliveryToken(token: string) {
  return withSystem(async (c) => {
    const { rows } = await c.query(
      `SELECT l.*, b.name AS brand_name FROM leads l JOIN brands b ON b.id = l.brand_id
        WHERE l.delivery_token = $1 AND l.sale_status = 'sold' LIMIT 1`,
      [token]
    );
    const r = rows[0];
    if (!r) return null;
    if (!r.delivered_at) await c.query(`UPDATE leads SET delivered_at = now() WHERE id = $1`, [r.id]);
    const contact = decodePayload(r.payload_encrypted);
    return {
      brandName: r.brand_name, buyer: r.buyer, serviceInterest: r.service_interest, pagePath: r.page_path,
      soldAt: r.sold_at, deliveredAt: r.delivered_at, qualityScore: r.quality_score, priceUsd: Number(r.price_usd),
      consent: r.consent, utm: r.utm, contact,
    };
  });
}

export async function leadStats(c: Client) {
  const { rows } = await c.query(`
    SELECT
      count(*)::int AS total,
      count(*) FILTER (WHERE validation_status='valid')::int AS valid,
      count(*) FILTER (WHERE sale_status='for_sale')::int AS for_sale,
      count(*) FILTER (WHERE sale_status='sold')::int AS sold,
      COALESCE(sum(price_usd) FILTER (WHERE sale_status='sold'),0)::numeric AS revenue,
      COALESCE(sum(price_usd) FILTER (WHERE sale_status='for_sale'),0)::numeric AS pipeline
    FROM leads`);
  return rows[0];
}
