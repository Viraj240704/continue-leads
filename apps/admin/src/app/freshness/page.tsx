import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getFreshness } from "@/lib/freshness";
import { AppShell } from "@/components/AppShell";
import { Regen } from "./Regen";

export const dynamic = "force-dynamic";

export default async function FreshnessPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requirePermission("pages", "read");
  const sp = await searchParams;
  const days = Math.max(0, Number(sp.days ?? "90") || 90);
  const { rows, staleCount, staleDays } = await withTenant(user.tenantId, (c) => getFreshness(c, days));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">Maintenance</p>
          <h1 className="font-display text-2xl font-bold">Content freshness</h1>
          <p className="text-sm text-dim">Money pages (service × city) decay: stale after {staleDays} days, or when the product pack changed since generation. Regenerate to rewrite, or add content to grow the page.</p>
        </div>
        <div className="flex items-center gap-1 text-xs">
          <span className="text-faint mr-1">Stale after</span>
          {[30, 60, 90].map((d) => (
            <Link key={d} href={`/freshness?days=${d}`} className={`rounded-md px-2 py-1 ${d === staleDays ? "bg-amber/15 text-amber" : "text-dim hover:bg-raised"}`}>{d}d</Link>
          ))}
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-md">
        <Tile label="Pages" value={rows.length} />
        <Tile label="Stale" value={staleCount} accent={staleCount > 0} />
        <Tile label="Fresh" value={rows.length - staleCount} />
      </div>

      <div className="data-table overflow-x-auto rounded-[var(--r-lg)] border border-line">
        <table className="w-full border-collapse">
          <thead className="bg-raised/40"><tr>
            <th className="th">Page</th><th className="th">Brand</th><th className="th">Generated</th>
            <th className="th">Age</th><th className="th">State</th><th className="th text-right"></th>
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.pageId} className={`border-t border-line/60 ${r.stale ? "bg-warn/5" : ""}`}>
                <td className="td mono text-xs">{r.path}</td>
                <td className="td text-xs text-dim">{r.brandName}</td>
                <td className="td text-xs text-faint">{new Date(r.genAt).toLocaleDateString()}</td>
                <td className="td mono text-xs">{r.ageDays}d</td>
                <td className="td">
                  {r.stale
                    ? <span className="pill bg-warn/15 text-warn">{r.packDrift ? "pack changed" : "stale"}</span>
                    : <span className="pill bg-ok/15 text-ok">fresh</span>}
                </td>
                <td className="td text-right"><Regen brandId={r.brandId} pageId={r.pageId} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="card py-3">
      <div className="stat-num" style={accent ? { color: "var(--warn)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
