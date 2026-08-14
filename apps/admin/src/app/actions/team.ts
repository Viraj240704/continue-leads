"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { can, isRole, type Role } from "@/lib/rbac";
import { createInvite, revokeInvite, setAutoJoin, changeUserRole } from "@/lib/team";

async function requireAdmin() {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "users", "write")) throw new Error("Not authorized");
  return u;
}

export async function inviteMemberAction(email: string, role: Role) {
  const u = await requireAdmin();
  const res = await withTenant(u.tenantId, (c) => createInvite(c, u.tenantId, { email, role, invitedBy: u.userId }));
  revalidatePath("/team");
  return res;
}

export async function revokeInviteAction(id: string) {
  const u = await requireAdmin();
  await withTenant(u.tenantId, (c) => revokeInvite(c, id));
  revalidatePath("/team");
  return { ok: true };
}

export async function setAutoJoinAction(value: boolean) {
  const u = await requireAdmin();
  await withTenant(u.tenantId, (c) => setAutoJoin(c, u.tenantId, value));
  revalidatePath("/team");
  return { ok: true };
}

export async function changeRoleAction(userId: string, role: Role) {
  const u = await requireAdmin();
  if (userId === u.userId) return { ok: false, error: "You can't change your own role." };
  const res = await withTenant(u.tenantId, (c) => changeUserRole(c, userId, role));
  revalidatePath("/team");
  return res;
}
