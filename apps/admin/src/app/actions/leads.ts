"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { withTenant } from "@/lib/db";
import { can, isRole } from "@/lib/rbac";
import { transitionLead, listLeadsFiltered, type LeadFilters } from "@/lib/lead-lifecycle";

async function requireLeadWrite() {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "leads", "write")) throw new Error("Not authorized");
  return u;
}

export async function validateLeadsAction(ids: string[]) {
  const u = await requireLeadWrite();
  const res = await withTenant(u.tenantId, async (c) => {
    let ok = 0; const errs: string[] = [];
    for (const id of ids) { const r = await transitionLead(c, u.tenantId, id, "validated", u.userId); r.ok ? ok++ : errs.push(r.error!); }
    return { ok, errs };
  });
  revalidatePath("/leads");
  return res;
}

export async function rejectLeadsAction(ids: string[], note?: string) {
  const u = await requireLeadWrite();
  const res = await withTenant(u.tenantId, async (c) => {
    let ok = 0; const errs: string[] = [];
    for (const id of ids) { const r = await transitionLead(c, u.tenantId, id, "rejected", u.userId, note); r.ok ? ok++ : errs.push(r.error!); }
    return { ok, errs };
  });
  revalidatePath("/leads");
  return res;
}

export async function returnLeadAction(id: string, reason: string) {
  const u = await requireLeadWrite();
  const res = await withTenant(u.tenantId, (c) => transitionLead(c, u.tenantId, id, "returned", u.userId, reason));
  revalidatePath("/leads");
  revalidatePath(`/leads/${id}`);
  return res;
}

// CSV export of the current filter selection (non-PII fields).
export async function exportLeadsAction(filters: LeadFilters): Promise<string> {
  const u = await requireUser();
  const role = isRole(u.role) ? u.role : "dev";
  if (!can(role, "leads", "read")) throw new Error("Not authorized");
  const { rows } = await withTenant(u.tenantId, (c) => listLeadsFiltered(c, { ...filters, page: 1, pageSize: 100 }));
  const esc = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const header = ["lead_id", "site", "category", "source_path", "lifecycle", "price_usd", "captured_at"];
  const lines = rows.map((r) => [r.id, r.brandName, r.category, r.source, r.lifecycle, r.priceUsd.toFixed(2), r.createdAt].map(esc).join(","));
  return [header.map(esc).join(","), ...lines].join("\n");
}
