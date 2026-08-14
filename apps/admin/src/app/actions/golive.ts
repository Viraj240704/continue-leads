"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { can, isRole } from "@/lib/rbac";
import { recordSampleReview } from "@/lib/golive";
import { audit } from "@/lib/audit";

export async function recordSampleReviewAction(brandId: string, note: string) {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "sites", "write")) throw new Error("Not authorized");
  await withTenant(u.tenantId, async (c) => {
    await recordSampleReview(c, brandId, u.name, note);
    await audit(c, { tenantId: u.tenantId, brandId, eventType: "golive_sample_reviewed", actorUserId: u.userId, detail: { reviewer: u.name, note } });
  });
  revalidatePath(`/brands/${brandId}`);
  return { ok: true };
}
