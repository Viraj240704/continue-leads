import "server-only";
import type { Client } from "./db";

export interface FreshRow {
  pageId: string; path: string; brandId: string; brandName: string; deploymentState: string;
  genAt: string; ageDays: number; genPack: number | null; curPack: number; packDrift: boolean; stale: boolean;
}

// Content freshness/decay: a page is stale when it's older than the threshold OR its
// vertical-pack version has moved on since it was generated (inputs changed).
export async function getFreshness(c: Client, staleDays = 90): Promise<{ rows: FreshRow[]; staleCount: number; staleDays: number }> {
  const { rows } = await c.query(`
    SELECT sp.id, sp.path, sp.brand_id, b.name AS brand_name, sp.deployment_state,
           pv.created_at AS gen_at,
           (pv.gen_metadata->>'packVersion')::int AS gen_pack,
           vp.version AS cur_pack,
           EXTRACT(EPOCH FROM (now() - pv.created_at)) / 86400.0 AS age_days
      FROM site_pages sp
      JOIN page_versions pv ON pv.id = sp.current_version_id
      JOIN brands b ON b.id = sp.brand_id
      JOIN vertical_packs vp ON vp.id = b.vertical_pack_id
     WHERE sp.enabled = true AND sp.page_type = 'MONEY'
     ORDER BY pv.created_at ASC`);

  const out: FreshRow[] = rows.map((r) => {
    const ageDays = Math.round(Number(r.age_days) * 10) / 10;
    const packDrift = r.gen_pack != null && Number(r.gen_pack) < Number(r.cur_pack);
    return {
      pageId: r.id, path: r.path, brandId: r.brand_id, brandName: r.brand_name, deploymentState: r.deployment_state,
      genAt: r.gen_at, ageDays, genPack: r.gen_pack, curPack: r.cur_pack, packDrift,
      stale: ageDays > staleDays || packDrift,
    };
  });
  out.sort((a, b) => (Number(b.stale) - Number(a.stale)) || b.ageDays - a.ageDays);
  return { rows: out, staleCount: out.filter((r) => r.stale).length, staleDays };
}
