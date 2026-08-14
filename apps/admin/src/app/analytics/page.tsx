import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requirePermission("sites", "read");
  const a = await withTenant(user.tenantId, (c) => getAnalytics(c));

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <p className="eyebrow mb-1">Control plane</p>
        <h1 className="font-display text-2xl font-bold">Analytics</h1>
        <p className="text-sm text-dim">Production, quality, publishing and revenue across every brand.</p>
      </div>

      {/* KPI row — hero numbers */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Brands" value={a.brands.total} sub={`${a.brands.active} active · ${a.brands.paused} paused`} />
        <Kpi label="Live pages" value={a.pages.published} sub={`${a.pages.total} planned`} />
        <Kpi label="Indexable" value={a.pages.indexable} />
        <Kpi label="QA pass" value={`${a.qa.rate}%`} sub={`${a.qa.pass}/${a.qa.total}`} />
        <Kpi label="Gen cost" value={`$${a.genCostUsd.toFixed(2)}`} />
        <Kpi label="Revenue" value={`$${a.leads.revenue.toFixed(0)}`} accent sub={`$${a.leads.pipeline.toFixed(0)} pipeline`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Lead funnel */}
        <div className="card">
          <p className="section-title mb-3">Lead funnel</p>
          <div className="space-y-2">
            <HBar label="Captured" value={a.leads.total} max={a.leads.total || 1} />
            <HBar label="Valid" value={a.leads.valid} max={a.leads.total || 1} />
            <HBar label="For sale" value={a.leads.forSale} max={a.leads.total || 1} />
            <HBar label="Sold" value={a.leads.sold} max={a.leads.total || 1} />
          </div>
        </div>

        {/* Publish velocity — single series over time */}
        <div className="card">
          <p className="section-title mb-3">Publish velocity <span className="text-xs font-normal text-faint">last 14 days</span></p>
          <Velocity data={a.publishVelocity} />
        </div>

        {/* Revenue by brand */}
        <div className="card">
          <p className="section-title mb-3">Revenue by brand</p>
          <MoneyBars rows={a.revenueByBrand} />
        </div>

        {/* Revenue by buyer */}
        <div className="card">
          <p className="section-title mb-3">Revenue by buyer</p>
          <MoneyBars rows={a.revenueByBuyer} />
        </div>
      </div>
    </AppShell>
  );
}

function Kpi({ label, value, sub, accent }: { label: string; value: number | string; sub?: string; accent?: boolean }) {
  return (
    <div className="card py-3">
      <div className="stat-num" style={accent ? { color: "var(--amber)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}

// Single-hue magnitude bar (amber), anchored to baseline, 4px rounded end.
function HBar({ label, value, max }: { label: string; value: number; max: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="flex items-center gap-3" title={`${label}: ${value}`}>
      <span className="w-16 text-xs text-dim">{label}</span>
      <div className="h-3 flex-1 overflow-hidden rounded-[3px]" style={{ background: "var(--line-soft)" }}>
        <div className="h-full rounded-[3px]" style={{ width: `${pct}%`, background: "var(--primary)" }} />
      </div>
      <span className="mono w-8 text-right text-xs">{value}</span>
    </div>
  );
}

function MoneyBars({ rows }: { rows: { name: string; revenue: number }[] }) {
  if (rows.length === 0) return <p className="text-sm text-faint">No sales yet.</p>;
  const max = Math.max(...rows.map((r) => r.revenue), 1);
  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-3" title={`${r.name}: $${r.revenue.toFixed(2)}`}>
          <span className="w-28 truncate text-xs text-dim">{r.name}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-[3px]" style={{ background: "var(--line-soft)" }}>
            <div className="h-full rounded-[3px]" style={{ width: `${Math.round((r.revenue / max) * 100)}%`, background: "var(--primary)" }} />
          </div>
          <span className="mono w-14 text-right text-xs">${r.revenue.toFixed(0)}</span>
        </div>
      ))}
    </div>
  );
}

function Velocity({ data }: { data: { day: string; count: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-faint">No pages published in the last 14 days.</p>;
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-28 items-end gap-2">
      {data.map((d) => (
        <div key={d.day} className="flex w-9 flex-col items-center gap-1" title={`${d.day}: ${d.count} published`}>
          <div className="w-full rounded-[3px]" style={{ height: `${Math.max(4, (d.count / max) * 92)}px`, background: "var(--primary)" }} />
          <span className="mono text-[9px] text-faint">{d.day}</span>
        </div>
      ))}
    </div>
  );
}
