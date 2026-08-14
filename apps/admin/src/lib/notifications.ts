import "server-only";
import type { Client } from "./db";
import { can, type Role } from "./rbac";

export interface Notif { kind: "lead" | "validation" | "qa" | "golive"; title: string; detail: string; href: string; at: string | null }

// Derived notifications — no separate event store needed; computed from live state.
export async function getNotifications(c: Client, role: Role): Promise<Notif[]> {
  const out: Notif[] = [];
  const seeLeads = can(role, "leads", "read");
  const seeSites = can(role, "sites", "read");

  if (seeLeads) {
    const newLeads = (await c.query(
      `SELECT count(*)::int n, max(created_at) last FROM leads
        WHERE (validation_status IS NULL OR validation_status NOT IN ('valid','invalid'))
          AND rejected_at IS NULL AND returned_at IS NULL AND sale_status <> 'sold'`
    )).rows[0];
    if (Number(newLeads.n) > 0) out.push({ kind: "lead", title: `${newLeads.n} new lead${newLeads.n === 1 ? "" : "s"}`, detail: "Awaiting validation", href: "/leads?status=new", at: newLeads.last });

    const failed = (await c.query(`SELECT count(*)::int n, max(rejected_at) last FROM leads WHERE validation_status='invalid'`)).rows[0];
    if (Number(failed.n) > 0) out.push({ kind: "validation", title: `${failed.n} lead${failed.n === 1 ? "" : "s"} failed validation`, detail: "Review rejected leads", href: "/leads?status=rejected", at: failed.last });
  }

  if (seeSites) {
    const qa = (await c.query(
      `SELECT b.id, b.name, count(*)::int n FROM site_pages sp JOIN brands b ON b.id = sp.brand_id
        WHERE sp.deployment_state = 'qa_failed' GROUP BY b.id, b.name ORDER BY n DESC LIMIT 3`
    )).rows;
    for (const r of qa) out.push({ kind: "qa", title: `${r.name}: ${r.n} page${r.n === 1 ? "" : "s"} failing QA`, detail: "Needs regeneration before go-live", href: `/brands/${r.id}`, at: null });

    const golive = (await c.query(
      `SELECT id, name FROM brands WHERE legal_approved = true AND status = 'active' LIMIT 3`
    ).catch(() => ({ rows: [] as any[] }))).rows;
    for (const r of golive) out.push({ kind: "golive", title: `${r.name} cleared for go-live`, detail: "Complete the go-live checklist to publish", href: `/brands/${r.id}`, at: null });
  }

  return out.slice(0, 12);
}
