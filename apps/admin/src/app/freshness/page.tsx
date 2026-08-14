import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getFreshness, type FreshRow } from "@/lib/freshness";
import { AppShell } from "@/components/AppShell";
import { AnalyticsIcon, FreshnessIcon, SearchIcon, TemplatesIcon } from "@/components/Icons";
import { Regen } from "./Regen";
import { FreshnessSelect } from "./FreshnessSelect";

export const dynamic = "force-dynamic";

const mockData: Array<[string, string, number, "fresh" | "stale" | "expiring"]> = [
  ["Kitchen Remodeling Denver", "Aug 12, 2026", 3, "fresh"], ["Roof Repair Austin", "Jun 18, 2026", 58, "fresh"],
  ["Bathroom Remodeling Phoenix", "May 05, 2026", 102, "stale"], ["HVAC Repair Chicago", "Jul 28, 2026", 18, "fresh"],
  ["Window Installation Miami", "Apr 30, 2026", 108, "stale"], ["Solar Installation Dallas", "Aug 01, 2026", 14, "fresh"],
  ["Flooring Seattle", "Jul 05, 2026", 41, "expiring"], ["Roof Inspection Tampa", "May 22, 2026", 85, "expiring"],
  ["Kitchen Cabinets Boston", "Aug 09, 2026", 6, "fresh"], ["Garage Door Houston", "Apr 18, 2026", 120, "stale"],
];
const mockRows: FreshRow[] = mockData.map(([path, generated, ageDays, status], index) => ({
  pageId: `mock-page-${index}`, path, brandId: "mock-brand", brandName: "ContinueLeads", deploymentState: "PUBLISHED",
  genAt: new Date(generated as string).toISOString(), ageDays: ageDays as number, genPack: null, curPack: 1,
  packDrift: status === "expiring", stale: status === "stale",
}));

export default async function FreshnessPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const user = await requirePermission("pages", "read");
  const sp = await searchParams;
  const days = Math.max(0, Number(sp.days ?? "90") || 90);
  const { rows, staleCount, staleDays } = await withTenant(user.tenantId, (c) => getFreshness(c, days));
  const displayRows = rows.length ? rows : mockRows;
  const displayStaleCount = rows.length ? staleCount : mockRows.filter((row) => row.stale).length;
  const freshCount = displayRows.length - displayStaleCount;

  return <AppShell user={user}><div className="mx-auto w-full max-w-[1400px]">
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><h1 className="font-sans text-l font-bold tracking-tight">Content freshness</h1><div className="flex items-center gap-1 text-xs"><span className="mr-1 text-faint">Stale after</span>{[30, 60, 90].map((d) => <Link key={d} href={`/freshness?days=${d}`} className={`rounded-lg px-2.5 py-1.5 font-medium ${d === staleDays ? "bg-primary/10 text-primary" : "text-dim hover:bg-raised"}`}>{d}d</Link>)}</div></div>
    <section className="mb-5 grid gap-3 sm:grid-cols-3" aria-label="Freshness summary"><MetricCard label="Pages" value={displayRows.length} helper="No content pages" tone="bg-primary/10" iconTone="text-primary" icon={TemplatesIcon} /><MetricCard label="Stale" value={displayStaleCount} helper="Require attention" tone="bg-warn/10" iconTone="text-warn" icon={FreshnessIcon} /><MetricCard label="Fresh" value={freshCount} helper="Up to date" tone="bg-ok/10" iconTone="text-ok" icon={AnalyticsIcon} /></section>
    <section className="card mb-5 rounded-[10px] p-2" aria-label="Content filters"><div className="grid items-center gap-2.5 xl:grid-cols-[minmax(240px,1.5fr)_repeat(4,minmax(135px,1fr))_auto]"><label className="relative block"><span className="sr-only">Search by page, brand or city</span><SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" /><input className="input h-[36px] rounded-[10px] border-[#D9E1EC] px-2.5 pl-9 text-[14px] font-medium" placeholder="Search by page, brand or city..." /></label><FreshnessSelect label="Brand" options={["All brands"]} /><FreshnessSelect label="State" options={["All states"]} /><FreshnessSelect label="Age" options={["All ages", "Fresh", "Stale"]} /><FreshnessSelect label="Status" options={["All status", "Fresh", "Stale", "Expiring"]} /><Link href="/freshness" className="btn-ghost h-[36px] rounded-[10px] whitespace-nowrap px-2.5 text-[14px]">↻ <span>Clear filters</span></Link></div></section>
    <section className="card overflow-hidden p-0" aria-label="Content freshness table"><div className="max-h-[620px] overflow-auto"><table className="w-full min-w-[860px] border-collapse"><thead className="sticky top-0 z-10 bg-[#F8FAFC]"><tr><th className="th">Page</th><th className="th">Brand</th><th className="th">Generated</th><th className="th">Age</th><th className="th">Status</th><th className="th text-right">Action</th></tr></thead><tbody>{displayRows.map((row) => <tr key={row.pageId} className="border-t border-line/70 transition-colors hover:bg-[#faf9ff]"><td className="td max-w-[360px] truncate py-2.5 font-medium">{row.path}</td><td className="td py-2.5 text-dim">{row.brandName}</td><td className="td py-2.5 text-dim">{new Date(row.genAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td><td className="td py-2.5 text-dim">{Math.round(row.ageDays)} days</td><td className="td py-2.5"><StatusBadge stale={row.stale} packDrift={row.packDrift} mock={!rows.length && row.packDrift} /></td><td className="td py-2.5 text-right">{rows.length ? <Regen brandId={row.brandId} pageId={row.pageId} /> : <MockAction status={row.stale ? (row.packDrift ? "Review" : "Regenerate") : "View"} />}</td></tr>)}</tbody></table></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-dim"><span>Showing {displayRows.length} of {displayRows.length} results</span><div className="flex items-center gap-2"><label className="sr-only" htmlFor="rows-per-page">Rows per page</label><select id="rows-per-page" className="input h-9 w-[130px] rounded-xl py-1.5 text-xs"><option>10 per page</option></select><button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim" disabled aria-label="Previous page">‹</button><button className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm" aria-current="page">1</button><button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim" disabled aria-label="Next page">›</button></div></div></section>
  </div></AppShell>;
}

function MetricCard({ label, value, helper, tone, iconTone, icon: Icon }: { label: string; value: number; helper: string; tone: string; iconTone: string; icon: (props: { size?: number; className?: string }) => React.JSX.Element }) { return <div className="card grid h-[120px] grid-cols-[56px_1fr] items-center gap-3 px-5"><div className={`grid h-14 w-14 place-items-center rounded-xl ${tone}`}><Icon size={28} className={iconTone} /></div><div><div className="text-[22px] font-bold leading-none tracking-tight tabular-nums">{value}</div><div className="mt-2 text-sm font-semibold text-ink">{label}</div><div className="mt-1 text-xs text-faint">{helper}</div></div></div>; }
function StatusBadge({ stale, packDrift, mock }: { stale: boolean; packDrift: boolean; mock?: boolean }) { const status = mock ? "Expiring" : stale ? (packDrift ? "Expiring" : "Stale") : "Fresh"; const tone = status === "Expiring" ? "bg-violet/10 text-violet" : status === "Stale" ? "bg-warn/10 text-warn" : "bg-ok/10 text-ok"; const dot = status === "Expiring" ? "bg-violet" : status === "Stale" ? "bg-warn" : "bg-ok"; return <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${tone}`}><span className={`h-1.5 w-1.5 rounded-full ${dot}`} />{status}</span>; }
function MockAction({ status }: { status: string }) { return <button type="button" className="btn-ghost btn-sm rounded-xl px-3">{status}</button>; }
