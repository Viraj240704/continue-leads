import "server-only";
import type { Client } from "./db";

export interface Analytics {
  brands: { total: number; active: number; paused: number };
  pages: { total: number; generated: number; published: number; indexable: number };
  qa: { pass: number; total: number; rate: number };
  genCostUsd: number;
  leads: { total: number; valid: number; forSale: number; sold: number; revenue: number; pipeline: number };
  revenueByBrand: { name: string; revenue: number }[];
  revenueByBuyer: { name: string; revenue: number }[];
  publishVelocity: { day: string; count: number }[];
}

export async function getAnalytics(c: Client): Promise<Analytics> {
  const brands = (await c.query(`
    SELECT count(*)::int total,
      count(*) FILTER (WHERE status='active')::int active,
      count(*) FILTER (WHERE status='paused')::int paused FROM brands`)).rows[0];

  const pages = (await c.query(`
    SELECT count(*)::int total,
      count(*) FILTER (WHERE current_version_id IS NOT NULL)::int generated,
      count(*) FILTER (WHERE deployment_state='published')::int published,
      count(*) FILTER (WHERE indexing_state='indexable')::int indexable FROM site_pages`)).rows[0];

  const qa = (await c.query(`
    WITH latest AS (
      SELECT DISTINCT ON (qr.page_version_id) qr.status
      FROM qa_runs qr JOIN site_pages sp ON sp.current_version_id = qr.page_version_id
      ORDER BY qr.page_version_id, qr.created_at DESC)
    SELECT count(*) FILTER (WHERE status='pass')::int pass, count(*)::int total FROM latest`)).rows[0];

  const cost = (await c.query(`SELECT COALESCE(sum(actual_cost),0)::numeric c FROM generation_jobs`)).rows[0].c;

  const leads = (await c.query(`
    SELECT count(*)::int total,
      count(*) FILTER (WHERE validation_status='valid')::int valid,
      count(*) FILTER (WHERE sale_status='for_sale')::int for_sale,
      count(*) FILTER (WHERE sale_status='sold')::int sold,
      COALESCE(sum(price_usd) FILTER (WHERE sale_status='sold'),0)::numeric revenue,
      COALESCE(sum(price_usd) FILTER (WHERE sale_status='for_sale'),0)::numeric pipeline
    FROM leads`)).rows[0];

  const revenueByBrand = (await c.query(`
    SELECT b.name, COALESCE(sum(l.price_usd),0)::numeric revenue
    FROM leads l JOIN brands b ON b.id=l.brand_id
    WHERE l.sale_status='sold' GROUP BY b.name ORDER BY revenue DESC LIMIT 8`)).rows;

  const revenueByBuyer = (await c.query(`
    SELECT COALESCE(by.name, l.buyer, 'Unassigned') name, COALESCE(sum(l.price_usd),0)::numeric revenue
    FROM leads l LEFT JOIN buyers by ON by.id=l.buyer_id
    WHERE l.sale_status='sold' GROUP BY COALESCE(by.name, l.buyer, 'Unassigned') ORDER BY revenue DESC LIMIT 8`)).rows;

  const velocity = (await c.query(`
    SELECT to_char(date_trunc('day', created_at),'MM-DD') AS d, count(*)::int AS n
    FROM publish_events WHERE event_type='published' AND created_at > now() - interval '14 days'
    GROUP BY 1 ORDER BY 1`)).rows;

  return {
    brands: { total: brands.total, active: brands.active, paused: brands.paused },
    pages: { total: pages.total, generated: pages.generated, published: pages.published, indexable: pages.indexable },
    qa: { pass: qa.pass, total: qa.total, rate: qa.total ? Math.round((qa.pass / qa.total) * 100) : 0 },
    genCostUsd: Number(cost),
    leads: { total: leads.total, valid: leads.valid, forSale: leads.for_sale, sold: leads.sold, revenue: Number(leads.revenue), pipeline: Number(leads.pipeline) },
    revenueByBrand: revenueByBrand.map((r) => ({ name: r.name, revenue: Number(r.revenue) })),
    revenueByBuyer: revenueByBuyer.map((r) => ({ name: r.name, revenue: Number(r.revenue) })),
    publishVelocity: velocity.map((r) => ({ day: r.d, count: r.n })),
  };
}
