import "server-only";
import type { Client } from "./db";

export interface HomeMetrics {
  sitesLive: number;
  activeZips: number;
  pageVisits: number | null; // null = GA4 not connected
  leadsToday: number;
  leadsByCategory: { category: string; count: number }[];
  recentLeads: { id: string; category: string; where: string; status: string; createdAt: string }[];
}

export async function getHomeMetrics(c: Client): Promise<HomeMetrics> {
  const sitesLive = Number(
    (await c.query(`SELECT count(*)::int n FROM brands WHERE status = 'active'`)).rows[0].n
  );

  // Distinct targeted ZIPs across live sites; fall back to distinct cities if no ZIPs set.
  const zipRow = (await c.query(
    `SELECT count(DISTINCT z)::int n
       FROM brands b, jsonb_array_elements_text(COALESCE(b.profile->'zips','[]'::jsonb)) z
      WHERE b.status = 'active'`
  )).rows[0];
  let activeZips = Number(zipRow.n);
  if (activeZips === 0) {
    activeZips = Number(
      (await c.query(
        `SELECT count(DISTINCT ci)::int n
           FROM brands b, jsonb_array_elements_text(COALESCE(b.profile->'cities','[]'::jsonb)) ci
          WHERE b.status = 'active'`
      )).rows[0].n
    );
  }

  const leadsToday = Number(
    (await c.query(`SELECT count(*)::int n FROM leads WHERE created_at::date = (now() AT TIME ZONE 'UTC')::date`)).rows[0].n
  );

  const leadsByCategory = (await c.query(
    `SELECT COALESCE(NULLIF(service_interest,''),'Uncategorized') AS category, count(*)::int AS count
       FROM leads GROUP BY 1 ORDER BY count DESC, category ASC LIMIT 5`
  )).rows.map((r) => ({ category: r.category as string, count: Number(r.count) }));

  const recentLeads = (await c.query(
    `SELECT id, COALESCE(NULLIF(service_interest,''),'—') AS category,
            COALESCE(NULLIF(page_path,''),'—') AS where_, status, created_at
       FROM leads ORDER BY created_at DESC LIMIT 10`
  )).rows.map((r) => ({
    id: r.id as string,
    category: r.category as string,
    where: r.where_ as string,
    status: r.status as string,
    createdAt: new Date(r.created_at).toISOString(),
  }));

  return { sitesLive, activeZips, pageVisits: null, leadsToday, leadsByCategory, recentLeads };
}
