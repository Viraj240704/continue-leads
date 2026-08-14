import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { AppShell } from "@/components/AppShell";
import { AnalyticsIcon, BuildingIcon, DollarIcon, GlobeIcon, ShieldCheckIcon, TemplatesIcon } from "@/components/Icons";
import { AnalyticsDashboard } from "@/components/AnalyticsDashboard";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const user = await requirePermission("sites", "read");
  const a = await withTenant(user.tenantId, (c) => getAnalytics(c));

  return (
    <AppShell user={user}>
      <div className="mb-5"><h1 className="font-sans text-xl font-bold tracking-tight">Analytics</h1></div>

      {/* KPI row — hero numbers */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi label="Brands" value={a.brands.total} sub={`${a.brands.active} active · ${a.brands.paused} paused`} />
        <Kpi label="Live pages" value={a.pages.published} sub={`${a.pages.total} planned`} />
        <Kpi label="Indexable" value={a.pages.indexable} sub={`${a.pages.indexable} indexable pages`} />
        <Kpi label="QA pass" value={`${a.qa.rate}%`} sub={`${a.qa.pass}/${a.qa.total}`} />
        <Kpi label="Gen cost" value={`$${a.genCostUsd.toFixed(2)}`} sub="No publishing cost yet" />
        <Kpi label="Revenue" value={`$${a.leads.revenue.toFixed(0)}`} accent sub={`$${a.leads.pipeline.toFixed(0)} pipeline`} />
      </div>

      <AnalyticsDashboard />
    </AppShell>
  );
}
function Kpi({ label, value, sub, icon, tone, iconTone }: { label: string; value: number | string; sub?: string; accent?: boolean; icon?: (props: { size?: number; className?: string }) => React.JSX.Element; tone?: string; iconTone?: string }) {
  const Icon = icon ?? ({ Brands: BuildingIcon, "Live pages": TemplatesIcon, Indexable: GlobeIcon, "QA pass": ShieldCheckIcon, "Gen cost": DollarIcon, Revenue: AnalyticsIcon }[label] ?? AnalyticsIcon);
  const iconToneClass = iconTone ?? ({ Brands: "text-primary", "Live pages": "text-info", Indexable: "text-ok", "QA pass": "text-warn", "Gen cost": "text-info", Revenue: "text-primary" }[label] ?? "text-primary");
  const toneClass = tone ?? ({ Brands: "bg-primary/10", "Live pages": "bg-info/10", Indexable: "bg-ok/10", "QA pass": "bg-warn/10", "Gen cost": "bg-info/10", Revenue: "bg-primary/10" }[label] ?? "bg-primary/10");
  return (
    <div className="card grid h-[120px] grid-cols-[56px_1fr] items-center gap-3 px-5">
      <div className={`grid h-12 w-12 place-items-center rounded-xl ${toneClass}`}><Icon size={24} className={iconToneClass} /></div>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
        <div className="mt-2 text-sm font-semibold text-ink">{label}</div>
        {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
      </div>
    </div>
  );
}

