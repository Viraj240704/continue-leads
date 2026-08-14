import "server-only";
import type { Client } from "./db";
import { audit } from "./audit";

export type Decision = "approved" | "rejected" | "regenerate";

/**
 * Record a reviewer decision for a page's current version (spec P8). A page can
 * only be approved if its latest QA did not FAIL (no blocking findings). Approval
 * does NOT make the page indexable — that happens only at publish time.
 */
export async function decidePage(
  c: Client,
  opts: { tenantId: string; brandId: string; pageId: string; reviewerUserId: string; decision: Decision; notes?: string }
): Promise<{ ok: boolean; reason?: string }> {
  const page = (await c.query(`SELECT id, current_version_id, deployment_state FROM site_pages WHERE id = $1`, [opts.pageId])).rows[0];
  if (!page?.current_version_id) return { ok: false, reason: "Page has no generated version." };

  if (opts.decision === "approved") {
    const qa = (await c.query(`SELECT status FROM qa_runs WHERE page_version_id = $1 ORDER BY created_at DESC LIMIT 1`, [page.current_version_id])).rows[0];
    if (qa?.status === "fail") return { ok: false, reason: "Cannot approve: QA has blocking findings." };
  }

  await c.query(
    `INSERT INTO approvals (tenant_id, page_id, page_version_id, reviewer_user_id, scope, decision, notes)
     VALUES ($1,$2,$3,$4,'page',$5,$6)`,
    [opts.tenantId, opts.pageId, page.current_version_id, opts.reviewerUserId, opts.decision, opts.notes ?? ""]
  );

  const state = opts.decision === "approved" ? "approved" : opts.decision === "rejected" ? "generated" : "draft";
  await c.query(`UPDATE site_pages SET deployment_state = $1 WHERE id = $2`, [state, opts.pageId]);

  await audit(c, {
    tenantId: opts.tenantId, brandId: opts.brandId, pageId: opts.pageId,
    eventType: opts.decision === "approved" ? "approved" : "rejected",
    actorUserId: opts.reviewerUserId, detail: { decision: opts.decision, notes: opts.notes ?? "" },
  });
  return { ok: true };
}

/** Approve every eligible generated page for a brand in one action (batch approval). */
export async function approveAllEligible(
  c: Client,
  opts: { tenantId: string; brandId: string; reviewerUserId: string }
): Promise<number> {
  const pages = (await c.query(
    `SELECT sp.id FROM site_pages sp
       WHERE sp.brand_id = $1 AND sp.enabled = true AND sp.current_version_id IS NOT NULL
         AND sp.deployment_state IN ('generated')
         AND COALESCE((SELECT status FROM qa_runs qr WHERE qr.page_version_id = sp.current_version_id ORDER BY qr.created_at DESC LIMIT 1),'fail') <> 'fail'`,
    [opts.brandId]
  )).rows;
  let n = 0;
  for (const p of pages) {
    const r = await decidePage(c, { ...opts, pageId: p.id, decision: "approved" });
    if (r.ok) n++;
  }
  return n;
}
