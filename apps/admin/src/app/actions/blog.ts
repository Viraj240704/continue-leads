"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { can, isRole } from "@/lib/rbac";
import { saveBlogForBrand } from "@/lib/blog-admin";
import type { BlogConfig } from "@/lib/blog";

export async function saveBlogAction(brandId: string, config: BlogConfig) {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "sites", "write")) throw new Error("Not authorized");
  const res = await withTenant(u.tenantId, (c) => saveBlogForBrand(c, u.tenantId, brandId, config, u.userId));
  revalidatePath(`/brands/${brandId}`);
  return res;
}
