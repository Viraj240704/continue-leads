import "server-only";
import type { Client } from "./db";
import { deriveLifecycle, type LeadFilters, type LeadPage, type Lifecycle } from "./lead-lifecycle-types";

export * from "./lead-lifecycle-types";

export async function listLeadsFiltered(c: Client, f: LeadFilters): Promise<LeadPage> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = Math.min(100, Math.max(5, f.pageSize ?? 25));
  const where: string[] = [];
  const args: any[] = [];
  const add = (frag: string, val: any) => { args.push(val); where.push(frag.replace("$$", `$${args.length}`)); };

  if (f.brandId) add("l.brand_id = $$", f.brandId);
  if (f.category) add("l.service_interest = $$", f.category);
  if (f.from) add("l.created_at >= $$", f.from);
  if (f.to) add("l.created_at < ($$::date + 1)", f.to);
  if (f.q) { const like = `%${f.q.toLowerCase()}%`; args.push(like); where.push(`(lower(l.service_interest) LIKE $${args.length} OR lower(l.page_path) LIKE $${args.length} OR l.id::text LIKE $${args.length})`); }

  // Lifecycle filter maps onto underlying columns.
  if (f.status) {
    const m: Record<Lifecycle, string> = {
      returned: "l.returned_at IS NOT NULL",
      sold: "l.sale_status = 'sold' AND l.returned_at IS NULL",
      rejected: "(l.rejected_at IS NOT NULL OR l.validation_status = 'invalid' OR l.sale_status = 'rejected') AND l.returned_at IS NULL AND l.sale_status <> 'sold'",
      validated: "l.validation_status = 'valid' AND l.sale_status NOT IN ('sold','rejected') AND l.rejected_at IS NULL AND l.returned_at IS NULL",
      new: "(l.validation_status IS NULL OR l.validation_status NOT IN ('valid','invalid')) AND l.rejected_at IS NULL AND l.returned_at IS NULL AND l.sale_status <> 'sold'",
    };
    where.push(`(${m[f.status]})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = Number((await c.query(`SELECT count(*)::int n FROM leads l ${whereSql}`, args)).rows[0].n);

  const rows = (await c.query(
    `SELECT l.id, l.brand_id, b.name AS brand_name,
            COALESCE(NULLIF(l.service_interest,''),'—') AS category,
            COALESCE(NULLIF(l.page_path,''),'—') AS source,
            l.validation_status, l.sale_status, l.returned_at, l.rejected_at,
            l.price_usd, l.created_at
       FROM leads l JOIN brands b ON b.id = l.brand_id
       ${whereSql}
       ORDER BY l.created_at DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`, args
  )).rows.map((r) => ({
    id: r.id, brandId: r.brand_id, brandName: r.brand_name, category: r.category,
    source: r.source, lifecycle: deriveLifecycle(r), priceUsd: Number(r.price_usd),
    createdAt: new Date(r.created_at).toISOString(),
  }));

  const brands = (await c.query(`SELECT id, name FROM brands ORDER BY name`)).rows.map((r) => ({ id: r.id, name: r.name }));
  const categories = (await c.query(`SELECT DISTINCT service_interest FROM leads WHERE COALESCE(service_interest,'') <> '' ORDER BY 1`)).rows.map((r) => r.service_interest as string);

  return { rows, total, page, pageSize, brands, categories };
}

export async function getStatusHistory(c: Client, leadId: string) {
  return (await c.query(
    `SELECT e.from_status, e.to_status, e.note, e.created_at, u.name AS actor
       FROM lead_status_events e LEFT JOIN users u ON u.id = e.actor_user_id
      WHERE e.lead_id = $1 ORDER BY e.created_at ASC`, [leadId]
  )).rows.map((r) => ({ from: r.from_status, to: r.to_status, note: r.note, at: new Date(r.created_at).toISOString(), actor: r.actor as string | null }));
}

async function recordEvent(c: Client, tenantId: string, leadId: string, from: Lifecycle, to: Lifecycle, actor: string, note?: string) {
  await c.query(
    `INSERT INTO lead_status_events (tenant_id, lead_id, from_status, to_status, note, actor_user_id) VALUES ($1,$2,$3,$4,$5,$6)`,
    [tenantId, leadId, from, to, note ?? null, actor]
  );
}

async function currentLifecycle(c: Client, leadId: string): Promise<Lifecycle> {
  const r = (await c.query(`SELECT validation_status, sale_status, returned_at, rejected_at FROM leads WHERE id=$1`, [leadId])).rows[0];
  return r ? deriveLifecycle(r) : "new";
}

export async function transitionLead(
  c: Client, tenantId: string, leadId: string, to: "validated" | "rejected" | "returned", actor: string, note?: string
): Promise<{ ok: boolean; error?: string }> {
  const from = await currentLifecycle(c, leadId);
  if (to === "validated") {
    if (from === "sold" || from === "returned") return { ok: false, error: `Can't validate a ${from} lead.` };
    await c.query(`UPDATE leads SET validation_status='valid', rejected_at=NULL WHERE id=$1`, [leadId]);
  } else if (to === "rejected") {
    if (from === "sold") return { ok: false, error: "Can't reject a sold lead — return it instead." };
    await c.query(`UPDATE leads SET validation_status='invalid', rejected_at=now() WHERE id=$1`, [leadId]);
  } else if (to === "returned") {
    if (from !== "sold") return { ok: false, error: "Only sold leads can be returned." };
    await c.query(`UPDATE leads SET returned_at=now(), return_reason=$2 WHERE id=$1`, [leadId, note ?? "buyer dispute"]);
  }
  await recordEvent(c, tenantId, leadId, from, to, actor, note);
  return { ok: true };
}
