"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { deleteAsset, setBrandLogo } from "@/lib/assets";
import { checkDomain, purchaseDomain } from "@/lib/domains";
import { markLeadSold, revalidateLead } from "@/lib/leads-admin";

export async function updateBriefAction(brandId: string, brief: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => c.query(`UPDATE brands SET brief = $1 WHERE id = $2`, [brief, brandId]));
  revalidatePath(`/brands/${brandId}`);
}

export async function deleteAssetAction(brandId: string, assetId: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => deleteAsset(c, brandId, assetId));
  revalidatePath(`/brands/${brandId}`);
}

export async function setLogoAction(brandId: string, assetId: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => setBrandLogo(c, brandId, assetId));
  revalidatePath(`/brands/${brandId}`);
}

export async function checkDomainAction(domain: string) {
  await requireUser();
  return checkDomain(domain);
}

export async function purchaseDomainAction(brandId: string, domain: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, (c) => purchaseDomain(c, { tenantId: u.tenantId, brandId, domain, actorUserId: u.userId }));
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function sellLeadAction(leadId: string, buyerId: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, async (c) => {
    const { getBuyer } = await import("@/lib/buyers");
    const buyer = await getBuyer(c, buyerId);
    if (!buyer) return { ok: false as const, reason: "Buyer not found" };
    return markLeadSold(c, { tenantId: u.tenantId, leadId, buyer: buyer.name, buyerId, actorUserId: u.userId });
  });
  revalidatePath(`/leads`);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/buyers`);
  return res;
}

export async function createBuyerAction(input: {
  name: string; company?: string; email?: string; phone?: string;
  verticals?: string[]; geos?: string[]; bidFloor?: number; deliveryEndpoint?: string; termsAccepted?: boolean;
}) {
  const u = await requireUser();
  const { createBuyer } = await import("@/lib/buyers");
  const b = await withTenant(u.tenantId, (c) => createBuyer(c, { tenantId: u.tenantId, ...input }));
  revalidatePath(`/buyers`);
  return { id: b.id, accessToken: b.access_token };
}

export async function approveBuyerAction(buyerId: string, approve: boolean) {
  const u = await requireUser();
  const { setBuyerApproval } = await import("@/lib/buyers");
  await withTenant(u.tenantId, (c) => setBuyerApproval(c, buyerId, approve));
  revalidatePath(`/buyers`);
  revalidatePath(`/buyers/${buyerId}`);
}

export async function legalApproveBrandAction(brandId: string, approve: boolean, notes?: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => c.query(
    `UPDATE brands SET legal_approved=$1, legal_approved_by=$2, legal_approved_at=$3, compliance_notes=COALESCE($4, compliance_notes) WHERE id=$5`,
    [approve, approve ? u.userId : null, approve ? new Date() : null, notes ?? null, brandId]
  ));
  revalidatePath(`/brands/${brandId}`);
}

export async function revalidateLeadAction(leadId: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, (c) => revalidateLead(c, leadId));
  revalidatePath(`/leads`);
  revalidatePath(`/leads/${leadId}`);
  return res;
}

// ---- Per-page controls ----
export async function setPageEnabledAction(brandId: string, pageId: string, enabled: boolean) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => c.query(`UPDATE site_pages SET enabled = $1 WHERE id = $2 AND brand_id = $3`, [enabled, pageId, brandId]));
  revalidatePath(`/brands/${brandId}`);
}

export async function updatePageBriefAction(brandId: string, pageId: string, brief: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => c.query(`UPDATE site_pages SET brief = $1 WHERE id = $2 AND brand_id = $3`, [brief, pageId, brandId]));
  revalidatePath(`/brands/${brandId}`);
}

export async function regeneratePageAction(brandId: string, pageId: string) {
  const u = await requireUser();
  const { generatePages } = await import("@/lib/jobs");
  const res = await withTenant(u.tenantId, (c) => generatePages(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId, pageIds: [pageId] }));
  revalidatePath(`/brands/${brandId}`);
  revalidatePath(`/freshness`);
  return res;
}

export async function addContentAction(brandId: string, pageId: string) {
  const u = await requireUser();
  const { addContentToPage } = await import("@/lib/jobs");
  const res = await withTenant(u.tenantId, (c) => addContentToPage(c, { tenantId: u.tenantId, brandId, pageId, actorUserId: u.userId }));
  revalidatePath(`/brands/${brandId}`);
  revalidatePath(`/freshness`);
  return res;
}

export async function launchPageNowAction(brandId: string, pageId: string) {
  const u = await requireUser();
  const { publishPageNow } = await import("@/lib/publisher");
  const res = await withTenant(u.tenantId, (c) => publishPageNow(c, { tenantId: u.tenantId, brandId, pageId, actorUserId: u.userId }));
  revalidatePath(`/brands/${brandId}`);
  return res;
}

// ---- Bulk page actions (single transaction) ----
export async function bulkDecideAction(brandId: string, pageIds: string[], decision: "approved" | "rejected") {
  const u = await requireUser();
  const { decidePage } = await import("@/lib/approvals");
  const n = await withTenant(u.tenantId, async (c) => {
    let ok = 0;
    for (const id of pageIds) {
      const r = await decidePage(c, { tenantId: u.tenantId, brandId, pageId: id, reviewerUserId: u.userId, decision });
      if (r.ok) ok++;
    }
    return ok;
  });
  revalidatePath(`/brands/${brandId}`);
  return { count: n };
}

export async function bulkSetEnabledAction(brandId: string, pageIds: string[], enabled: boolean) {
  const u = await requireUser();
  if (!pageIds.length) return { count: 0 };
  const n = await withTenant(u.tenantId, async (c) => {
    const r = await c.query(`UPDATE site_pages SET enabled=$1 WHERE brand_id=$2 AND id = ANY($3)`, [enabled, brandId, pageIds]);
    return r.rowCount ?? 0;
  });
  revalidatePath(`/brands/${brandId}`);
  return { count: n };
}

export async function bulkRegenerateAction(brandId: string, pageIds: string[]) {
  const u = await requireUser();
  if (!pageIds.length) return { generated: 0 };
  const { generatePages } = await import("@/lib/jobs");
  const res = await withTenant(u.tenantId, (c) => generatePages(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId, pageIds }));
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function reschedulePageAction(brandId: string, pageId: string, scheduledAtIso: string) {
  const u = await requireUser();
  const when = new Date(scheduledAtIso);
  if (isNaN(when.getTime())) return { ok: false, reason: "Invalid date" };
  const res = await withTenant(u.tenantId, async (c) => {
    const r = await c.query(
      `UPDATE publish_schedule SET scheduled_at = $1
        WHERE brand_id = $2 AND page_id = $3 AND status = 'scheduled'`,
      [when, brandId, pageId]
    );
    return r.rowCount ?? 0;
  });
  revalidatePath(`/brands/${brandId}`);
  return { ok: res > 0, reason: res > 0 ? undefined : "No scheduled entry to move (publish it or build schedule first)" };
}
