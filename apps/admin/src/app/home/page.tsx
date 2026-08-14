import Link from "next/link";
import { requireSession, roleOf } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getHomeMetrics } from "@/lib/home";
import { AppShell } from "@/components/AppShell";
import { ROLE_LABELS } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-[36px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
      <div className="section-title mt-2 text-[13px]">{label}</div>
      {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
    </div>
  );
}

export default async function HomePage() {
  const user = await requireSession();
  const role = roleOf(user);
  const m = await withTenant(user.tenantId, (c) => getHomeMetrics(c));

  // Dashboard role-scoping (deck pg.5): Sales -> LMP only, Dev -> BMP only, Admin/Ops -> both.
  const showBMP = role !== "sales";
  const showLMP = role !== "dev";

  return (
    <AppShell user={user}>
      <div className="mb-5">
        <h1 className="font-sans text-2xl font-bold tracking-tight sm:text-3xl">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="mt-1 text-sm text-dim">
          {ROLE_LABELS[role]} view ·{" "}
          {showBMP && showLMP ? "brand + lead metrics" : showBMP ? "brand metrics" : "lead metrics"}
        </p>
      </div>

      {showBMP && (
        <section className="mb-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-dim">Brand management</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi label="Sites live" value={String(m.sitesLive)} />
            <Kpi label="Active ZIP codes" value={String(m.activeZips)} sub="ZIPs with ranking pages" />
            <Kpi
              label="Page visits"
              value={m.pageVisits === null ? "—" : m.pageVisits.toLocaleString()}
              sub={m.pageVisits === null ? "Connect GA4 to populate" : "across all sites"}
            />
          </div>
        </section>
      )}

      {showLMP && (
        <section>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium text-dim">Lead management</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-[260px_1fr]">
            <div className="grid gap-3">
              <Kpi label="Leads today" value={String(m.leadsToday)} />
              <div className="card p-4">
                <div className="section-title mb-2">Leads by category</div>
                {m.leadsByCategory.length === 0 ? (
                  <p className="text-sm text-faint">No leads yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {m.leadsByCategory.map((r) => (
                      <li key={r.category} className="flex items-center justify-between text-sm">
                        <span className="truncate text-dim">{r.category}</span>
                        <span className="font-semibold tabular-nums">{r.count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <div className="section-title">Recent leads</div>
                <Link href="/leads" className="text-xs text-primary hover:underline">View all →</Link>
              </div>
              {m.recentLeads.length === 0 ? (
                <p className="text-sm text-faint">No leads captured yet.</p>
              ) : (
                <div className="overflow-hidden rounded-md border border-line">
                  <table className="w-full text-sm">
                    <thead className="bg-canvas text-left text-xs text-faint">
                      <tr>
                        <th className="px-3 py-2 font-medium">Category</th>
                        <th className="px-3 py-2 font-medium">Source</th>
                        <th className="px-3 py-2 font-medium">Status</th>
                        <th className="px-3 py-2 font-medium">Captured</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {m.recentLeads.map((l) => (
                        <tr key={l.id}>
                          <td className="px-3 py-2">{l.category}</td>
                          <td className="mono px-3 py-2 text-xs text-dim">{l.where}</td>
                          <td className="px-3 py-2">
                            <span className="pill bg-primary/10 text-primary">{l.status}</span>
                          </td>
                          <td className="px-3 py-2 text-xs text-faint">
                            {new Date(l.createdAt).toLocaleString("en-US", { timeZone: "UTC", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      )}
    </AppShell>
  );
}
