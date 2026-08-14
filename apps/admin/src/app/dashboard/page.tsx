import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { listBrands } from "@/lib/sites";
import { AppShell, StatePill } from "@/components/AppShell";
import { WaveRail } from "@/components/WaveRail";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = await requirePermission("sites", "read");
  const brands = await withTenant(user.tenantId, (c) => listBrands(c));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">Factory floor</p>
          <h1 className="font-display text-2xl font-bold">Brands</h1>
          <p className="mt-1 text-sm text-dim">Configure a brand, generate its site, review QA, approve, and progressively publish.</p>
        </div>
        <Link href="/brands/new" className="btn">+ New brand</Link>
      </div>

      {brands.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-12 text-center text-dim">
          <WaveRail total={16} live={0} count={16} />
          <p>No brands yet. Spin up your first site.</p>
          <Link href="/brands/new" className="btn">Create your first brand</Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brands.map((b: any) => (
            <Link key={b.id} href={`/brands/${b.id}`} className="card group transition hover:border-amber/40 hover:shadow-glow">
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-display text-base font-bold">{b.name}</h3>
                  <p className="mono text-xs text-faint">{b.domain}</p>
                </div>
                <StatePill state={b.status} />
              </div>
              <div className="mb-4"><WaveRail total={Number(b.page_count)} live={Number(b.published_count)} count={16} /></div>
              <p className="mb-3 text-[11px] uppercase tracking-wider text-faint mono">{b.pack_name} · {b.template_family}</p>
              <div className="flex gap-5">
                <Stat label="Pages" value={b.page_count} />
                <Stat label="Live" value={b.published_count} accent />
                <Stat label="Indexable" value={b.indexable_count} />
              </div>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div>
      <div className="stat-num" style={accent ? { color: "var(--amber)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
