import "server-only";
import crypto from "node:crypto";
import type { Client } from "./db";
import { withSystem } from "./db";
import { decryptLead } from "./leads";

export interface BuyerRow {
  id: string; name: string; company: string; email: string; phone: string;
  status: string; access_token: string; notes: string; created_at: string;
  approval_status: string; verticals: string[]; geos: string[]; bid_floor: number;
  dedup_policy: string; delivery_endpoint: string; terms_accepted: boolean; approved_at: string | null;
}

export interface BuyerContract {
  verticals?: string[]; geos?: string[]; bidFloor?: number;
  dedupPolicy?: string; deliveryEndpoint?: string; termsAccepted?: boolean;
}

export async function createBuyer(
  c: Client,
  opts: { tenantId: string; name: string; company?: string; email?: string; phone?: string; notes?: string } & BuyerContract
): Promise<BuyerRow> {
  const token = crypto.randomBytes(20).toString("hex");
  const { rows } = await c.query(
    `INSERT INTO buyers (tenant_id, name, company, email, phone, notes, access_token,
        verticals, geos, bid_floor, dedup_policy, delivery_endpoint, terms_accepted)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [opts.tenantId, opts.name, opts.company ?? "", opts.email ?? "", opts.phone ?? "", opts.notes ?? "", token,
     opts.verticals ?? [], opts.geos ?? [], opts.bidFloor ?? 0,
     opts.dedupPolicy ?? "30-day phone+zip+vertical", opts.deliveryEndpoint ?? "", opts.termsAccepted ?? false]
  );
  return rows[0];
}

// Approve/reject a buyer's onboarding (gate A). Only approved buyers can be sold to.
export async function setBuyerApproval(c: Client, buyerId: string, approve: boolean) {
  await c.query(
    `UPDATE buyers SET approval_status=$1, approved_at=$2 WHERE id=$3`,
    [approve ? "approved" : "rejected", approve ? new Date() : null, buyerId]
  );
}

export async function listApprovedBuyers(c: Client): Promise<{ id: string; name: string }[]> {
  const { rows } = await c.query(
    `SELECT id, name FROM buyers WHERE approval_status='approved' AND status='active' ORDER BY name`);
  return rows;
}

export async function listBuyers(c: Client) {
  const { rows } = await c.query(`
    SELECT b.*,
      (SELECT count(*) FROM leads l WHERE l.buyer_id = b.id)::int AS lead_count,
      (SELECT count(*) FROM leads l WHERE l.buyer_id = b.id AND l.sale_status='sold')::int AS sold_count,
      COALESCE((SELECT sum(l.price_usd) FROM leads l WHERE l.buyer_id = b.id AND l.sale_status='sold'),0)::numeric AS spend
    FROM buyers b ORDER BY b.created_at DESC`);
  return rows;
}

export async function getBuyer(c: Client, id: string): Promise<BuyerRow | null> {
  const { rows } = await c.query(`SELECT * FROM buyers WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findOrCreateBuyer(c: Client, tenantId: string, opts: { buyerId?: string; buyerName?: string }): Promise<BuyerRow | null> {
  if (opts.buyerId) return getBuyer(c, opts.buyerId);
  if (opts.buyerName?.trim()) return createBuyer(c, { tenantId, name: opts.buyerName.trim() });
  return null;
}

// Public buyer portal: buyer + all their purchased leads (full contact). Token-gated.
export async function getBuyerPortal(accessToken: string) {
  return withSystem(async (c) => {
    const buyer = (await c.query(`SELECT * FROM buyers WHERE access_token = $1 AND status='active'`, [accessToken])).rows[0];
    if (!buyer) return null;
    const rows = (await c.query(
      `SELECT l.*, br.name AS brand_name FROM leads l JOIN brands br ON br.id = l.brand_id
        WHERE l.buyer_id = $1 AND l.sale_status='sold' ORDER BY l.sold_at DESC`,
      [buyer.id]
    )).rows;
    const leads = rows.map((r) => {
      let contact = { name: "", phone: "", email: "", message: "" };
      try { contact = JSON.parse(decryptLead(r.payload_encrypted)); } catch {}
      return {
        id: r.id, brandName: r.brand_name, serviceInterest: r.service_interest, soldAt: r.sold_at,
        priceUsd: Number(r.price_usd), qualityScore: r.quality_score, deliveredAt: r.delivered_at, contact,
      };
    });
    const spend = leads.reduce((s, l) => s + l.priceUsd, 0);
    return { buyer: { name: buyer.name, company: buyer.company }, leads, spend };
  });
}
