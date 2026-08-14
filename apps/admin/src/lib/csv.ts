import "server-only";
import type { Client } from "./db";
import { decryptLead } from "./leads";

function esc(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const HEADERS = [
  "sold_at", "lead_id", "brand", "buyer", "buyer_company", "buyer_email",
  "service_interest", "source_page", "quality_score", "price_usd",
  "contact_name", "contact_phone", "contact_email", "consent_timestamp", "delivered_at",
];

// Accounting export of sold leads. Optional filters: buyer, and sold-date range.
export async function soldLeadsCsv(
  c: Client,
  filters: { buyerId?: string; from?: string; to?: string } = {}
): Promise<string> {
  const where = ["l.sale_status = 'sold'"];
  const args: any[] = [];
  if (filters.buyerId) { args.push(filters.buyerId); where.push(`l.buyer_id = $${args.length}`); }
  if (filters.from) { args.push(filters.from); where.push(`l.sold_at >= $${args.length}`); }
  if (filters.to) { args.push(filters.to); where.push(`l.sold_at <= $${args.length}`); }

  const { rows } = await c.query(
    `SELECT l.*, br.name AS brand_name, b.name AS buyer_name, b.company AS buyer_company, b.email AS buyer_email
       FROM leads l
       JOIN brands br ON br.id = l.brand_id
       LEFT JOIN buyers b ON b.id = l.buyer_id
      WHERE ${where.join(" AND ")}
      ORDER BY l.sold_at DESC`,
    args
  );

  const lines = [HEADERS.join(",")];
  for (const r of rows) {
    let ct = { name: "", phone: "", email: "" };
    try { ct = JSON.parse(decryptLead(r.payload_encrypted)); } catch {}
    lines.push([
      r.sold_at ? new Date(r.sold_at).toISOString() : "",
      r.id, r.brand_name, r.buyer_name ?? r.buyer ?? "", r.buyer_company ?? "", r.buyer_email ?? "",
      r.service_interest, r.page_path, r.quality_score, Number(r.price_usd).toFixed(2),
      ct.name, ct.phone, ct.email, r.consent?.timestamp ?? "", r.delivered_at ? new Date(r.delivered_at).toISOString() : "",
    ].map(esc).join(","));
  }
  return lines.join("\n") + "\n";
}
