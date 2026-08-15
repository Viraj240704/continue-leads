import { requirePermission, roleOf } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { leadStats } from "@/lib/leads-admin";
import { listLeadsFiltered, type Lifecycle } from "@/lib/lead-lifecycle";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { AnalyticsIcon, CheckCircleIcon, DollarIcon, FileTextIcon, TagIcon, TeamIcon } from "@/components/Icons";
import { LeadsBrowser } from "./LeadsBrowser";

export const dynamic = "force-dynamic";

function Tile({ label, value, icon: Icon, accent, tone }: { label: string; value: React.ReactNode; icon: (props: { size?: number; className?: string }) => React.JSX.Element; accent: string; tone: string }) {
  return <div className="card relative py-3"><span className={`absolute right-3.5 top-3.5 rounded-lg p-2 ${tone} ${accent}`}><Icon size={19} /></span><div className="stat-num">{value}</div><div className="stat-label">{label}</div></div>;
}

export default async function LeadsPage({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const user = await requirePermission("leads", "read");
  const sp = await searchParams;
  const filters = {
    q: sp.q || undefined,
    status: (sp.status as Lifecycle) || undefined,
    brandId: sp.brand || undefined,
    category: sp.category || undefined,
    from: sp.from || undefined,
    to: sp.to || undefined,
    page: sp.page ? Number(sp.page) : 1,
  };
  const { data, stats } = await withTenant(user.tenantId, async (c) => ({
    data: await listLeadsFiltered(c, filters),
    stats: await leadStats(c),
  }));
  const canWrite = can(roleOf(user), "leads", "write");

  return (
    <AppShell user={user}>
      <div className="mb-5"><h1 className="font-sans text-l font-bold tracking-tight">Leads</h1></div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total" value={stats.total} icon={FileTextIcon} accent="text-primary" tone="bg-primary/10" />
        <Tile label="Valid" value={stats.valid} icon={CheckCircleIcon} accent="text-info" tone="bg-info/10" />
        <Tile label="For sale" value={stats.for_sale} icon={TagIcon} accent="text-ok" tone="bg-ok/10" />
        <Tile label="Sold" value={stats.sold} icon={TeamIcon} accent="text-warn" tone="bg-warn/10" />
        <Tile label="Revenue" value={`$${Number(stats.revenue).toFixed(0)}`} icon={DollarIcon} accent="text-info" tone="bg-info/10" />
        <Tile label="Pipeline" value={`$${Number(stats.pipeline).toFixed(0)}`} icon={AnalyticsIcon} accent="text-primary" tone="bg-primary/10" />
      </div>

      <LeadsBrowser data={data} filters={filters} canWrite={canWrite} />
    </AppShell>
  );
}
