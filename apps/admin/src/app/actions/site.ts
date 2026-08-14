"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { createBrandWithPlan, type CreateBrandInput } from "@/lib/sites";
import { generatePages } from "@/lib/jobs";
import { decidePage, approveAllEligible, type Decision } from "@/lib/approvals";
import { buildSchedule } from "@/lib/scheduler";
import { publishDue, rollbackBrand, pauseBrand, resumeBrand } from "@/lib/publisher";

// Returns the new brand id (does NOT redirect) so the wizard can upload logo/assets
// to the brand before navigating to its console.
export async function createBrandAction(input: CreateBrandInput, registerDomain?: boolean): Promise<string> {
  const u = await requireUser();
  return withTenant(u.tenantId, async (c) => {
    const id = await createBrandWithPlan(c, u.tenantId, u.userId, input);
    if (registerDomain) {
      const { purchaseDomain } = await import("@/lib/domains");
      await purchaseDomain(c, { tenantId: u.tenantId, brandId: id, domain: input.domain, actorUserId: u.userId });
    }
    return id;
  });
}

export async function generateAllAction(brandId: string) {
  const u = await requireUser();
  const summary = await withTenant(u.tenantId, (c) =>
    generatePages(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId })
  );
  revalidatePath(`/brands/${brandId}`);
  return summary;
}

export async function decideAction(brandId: string, pageId: string, decision: Decision, notes?: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, (c) =>
    decidePage(c, { tenantId: u.tenantId, brandId, pageId, reviewerUserId: u.userId, decision, notes })
  );
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function approveAllAction(brandId: string) {
  const u = await requireUser();
  const n = await withTenant(u.tenantId, (c) =>
    approveAllEligible(c, { tenantId: u.tenantId, brandId, reviewerUserId: u.userId })
  );
  revalidatePath(`/brands/${brandId}`);
  return { approved: n };
}

export async function scheduleAction(brandId: string) {
  const u = await requireUser();
  const waves = await withTenant(u.tenantId, (c) =>
    buildSchedule(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId })
  );
  revalidatePath(`/brands/${brandId}`);
  return waves;
}

export async function publishTickAction(brandId: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, (c) =>
    publishDue(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId })
  );
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function rollbackAction(brandId: string) {
  const u = await requireUser();
  const res = await withTenant(u.tenantId, (c) =>
    rollbackBrand(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId })
  );
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function pauseAction(brandId: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => pauseBrand(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId }));
  revalidatePath(`/brands/${brandId}`);
}

export async function resumeAction(brandId: string) {
  const u = await requireUser();
  await withTenant(u.tenantId, (c) => resumeBrand(c, { tenantId: u.tenantId, brandId, actorUserId: u.userId }));
  revalidatePath(`/brands/${brandId}`);
}
