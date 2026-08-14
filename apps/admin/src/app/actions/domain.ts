"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { can, isRole } from "@/lib/rbac";
import { verifyDomain } from "@/lib/domain";

async function requireSiteWrite() {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "sites", "write")) throw new Error("Not authorized");
  return u;
}

export async function verifyDomainAction(brandId: string) {
  const u = await requireSiteWrite();
  const res = await withTenant(u.tenantId, (c) => verifyDomain(c, brandId));
  revalidatePath(`/brands/${brandId}`);
  return res;
}

export async function updateDomainAction(brandId: string, domain: string) {
  const u = await requireSiteWrite();
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) return { ok: false, error: "Enter a valid domain." };
  await withTenant(u.tenantId, (c) =>
    c.query(`UPDATE brands SET domain = $2, domain_verified_at = NULL, domain_status = 'provided' WHERE id = $1`, [brandId, clean])
  );
  revalidatePath(`/brands/${brandId}`);
  return { ok: true };
}
