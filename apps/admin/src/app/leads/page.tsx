import { requirePermission, roleOf } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { leadStats } from "@/lib/leads-admin";
import { listLeadsFiltered, type Lifecycle } from "@/lib/lead-lifecycle";
import { can } from "@/lib/rbac";
import { AppShell } from "@/components/AppShell";
import { LeadsBrowser } from "./LeadsBrowser";

export const dynamic = "force-dynamic";

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="card py-3">
      <div className="text-xl font-bold tabular-nums">{value}</div>
      <div className="section-title mt-0.5">{label}</div>
    </div>
  );
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
      <div className="mb-5">
        <p className="eyebrow mb-1">Lead management</p>
        <h1 className="font-sans text-2xl font-bold">Leads</h1>
        <p className="text-sm text-dim">Captured leads through their lifecycle. Contact details are masked until a lead is opened.</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Tile label="Total" value={stats.total} />
        <Tile label="Valid" value={stats.valid} />
        <Tile label="For sale" value={stats.for_sale} />
        <Tile label="Sold" value={stats.sold} />
        <Tile label="Revenue" value={`$${Number(stats.revenue).toFixed(0)}`} />
        <Tile label="Pipeline" value={`$${Number(stats.pipeline).toFixed(0)}`} />
      </div>

      <LeadsBrowser data={data} filters={filters} canWrite={canWrite} />
    </AppShell>
  );
}
