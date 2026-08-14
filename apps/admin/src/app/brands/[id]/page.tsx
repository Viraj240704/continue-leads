import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, roleOf } from "@/lib/session";
import { can } from "@/lib/rbac";
import { DomainConnect } from "./DomainConnect";
import { GoLiveChecklist } from "./GoLiveChecklist";
import { BlogPanel } from "./BlogPanel";
import { withTenant } from "@/lib/db";
import { getBrand, listPages } from "@/lib/sites";
import { listAssets } from "@/lib/assets";
import { getBrandCompliance } from "@/lib/compliance";
import { Compliance } from "./Compliance";
import { AppShell, StatePill } from "@/components/AppShell";
import { PipelineBar } from "./Actions";
import { Manage } from "./Manage";
import { PagesTable } from "./PagesTable";
import { SchedulePanel } from "./SchedulePanel";
import { SiteConsoleTabs } from "./SiteConsoleTabs";
import { ActivityIcon, CheckCircleIcon, DollarIcon, FileTextIcon, GlobeIcon, ShieldCheckIcon, SparklesIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

export default async function BrandDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("sites", "read");
  const data = await withTenant(user.tenantId, async (c) => {
    const brand = await getBrand(c, id);
    if (!brand) return null;
    const pages = await listPages(c, id);
    const cost = (await c.query(`SELECT COALESCE(sum(actual_cost),0) AS c FROM generation_jobs WHERE brand_id = $1`, [id])).rows[0].c;
    const leads = (await c.query(`SELECT count(*) AS n FROM leads WHERE brand_id = $1`, [id])).rows[0].n;
    const manifest = (await c.query(`SELECT version, indexable_paths FROM site_manifests WHERE brand_id = $1 AND is_live = true LIMIT 1`, [id])).rows[0];
    const waves = (await c.query(`SELECT ps.page_id, ps.wave, ps.status, ps.scheduled_at, sp.path FROM publish_schedule ps JOIN site_pages sp ON sp.id = ps.page_id WHERE ps.brand_id = $1 ORDER BY ps.wave, ps.scheduled_at`, [id])).rows;
    const events = (await c.query(`SELECT event_type, detail, created_at FROM publish_events WHERE brand_id = $1 ORDER BY created_at DESC LIMIT 12`, [id])).rows;
    const assets = await listAssets(c, id);
    const compliance = await getBrandCompliance(c, id);
    const domainStatus = await (await import("@/lib/domain")).getDomainStatus(c, id);
    const goLive = await (await import("@/lib/golive")).getGoLiveStatus(c, id);
    const blogConfig = await (await import("@/lib/blog-admin")).getBlogConfig(c, id);
    return { brand, pages, cost, leads, manifest, waves, events, assets, compliance, domainStatus, goLive, blogConfig };
  });
  if (!data) notFound();
  const { brand, pages, cost, leads, manifest, waves, events, assets, compliance, domainStatus, goLive, blogConfig } = data;
  const canWriteSites = can(roleOf(user), "sites", "write");
  const counts = pages.reduce((m: Record<string, number>, p: any) => ((m[p.deployment_state] = (m[p.deployment_state] ?? 0) + 1), m), {});
  const qaPass = pages.filter((p: any) => p.qa_status === "pass").length;
  const qaTotal = pages.filter((p: any) => p.qa_status).length;

  return (
    <AppShell user={user}>
      <div className="mb-4 flex items-center justify-between"><div className="flex items-center gap-3"><h1 className="font-sans text-l font-bold tracking-tight">{brand.name}</h1><StatePill state={brand.status} /></div><Link href="/dashboard" className="btn-ghost">← All brands</Link></div>
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6"><Metric label="Pages" value={pages.length} icon={FileTextIcon} accent="text-primary" tone="bg-primary/10" /><Metric label="Generated" value={(counts.generated ?? 0) + (counts.approved ?? 0) + (counts.scheduled ?? 0) + (counts.published ?? 0)} icon={SparklesIcon} accent="text-blue-500" tone="bg-blue-500/10" /><Metric label="Approved" value={(counts.approved ?? 0) + (counts.scheduled ?? 0) + (counts.published ?? 0)} icon={CheckCircleIcon} accent="text-ok" tone="bg-ok/10" /><Metric label="Published" value={counts.published ?? 0} icon={GlobeIcon} accent="text-orange-500" tone="bg-orange-500/10" /><Metric label="QA pass" value={`${qaPass}/${qaTotal || 0}`} icon={ShieldCheckIcon} accent="text-teal-500" tone="bg-teal-500/10" /><Metric label="Gen cost" value={`$${Number(cost).toFixed(2)}`} icon={DollarIcon} accent="text-ink" tone="bg-raised" /></div>
      <SiteConsoleTabs>
        <div className="space-y-6"><Compliance brandId={brand.id} compliance={compliance} /><GoLiveChecklist brandId={brand.id} status={goLive} canWrite={canWriteSites} /><AuditLog events={events} /></div>
        <div className="space-y-6"><div><h2 className="mb-2 font-semibold">Brand inputs — provide before generating</h2><Manage brandId={brand.id} brief={brand.brief} domain={brand.domain} domainStatus={brand.domain_status} logoAssetId={brand.logo_asset_id} assets={assets as any} /></div><BlogPanel brandId={brand.id} domain={brand.domain} config={blogConfig} canWrite={canWriteSites} />{domainStatus && <DomainConnect brandId={brand.id} status={domainStatus} canWrite={canWriteSites} />}</div>
        <div className="space-y-6"><PipelineBar brandId={brand.id} status={brand.status} /><div><h2 className="mb-2 font-semibold">Publish schedule</h2><SchedulePanel brandId={brand.id} waves={waves as any} /></div></div>
        <section><h2 className="mb-2 font-semibold">Pages</h2><PagesTable brandId={brand.id} brandSlug={brand.slug} pages={pages as any} />{manifest && <p className="mt-2 text-xs text-faint">Live manifest <b>v{manifest.version}</b> · {manifest.indexable_paths?.length ?? 0} indexable · <a className="text-accent hover:underline" href={`/live/${brand.slug}`} target="_blank">view live site ↗</a> · <a className="text-accent hover:underline" href={`/live/${brand.slug}/sitemap.xml`} target="_blank">sitemap</a> · {leads} lead(s)</p>}</section>
        <div className="space-y-6"><GoLiveChecklist brandId={brand.id} status={goLive} canWrite={canWriteSites} /><div><h2 className="mb-2 font-semibold">Publish schedule</h2><SchedulePanel brandId={brand.id} waves={waves as any} /></div>{domainStatus && <DomainConnect brandId={brand.id} status={domainStatus} canWrite={canWriteSites} />}<AuditLog events={events} /></div>
      </SiteConsoleTabs>
    </AppShell>
  );
}

function AuditLog({ events }: { events: any[] }) {
  return <div><h2 className="mb-2 font-semibold">Audit log</h2><div className="card"><div className="grid grid-cols-1 gap-y-5 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-8">{events.length === 0 && <p className="text-sm text-dim sm:col-span-2 lg:col-span-4">No events yet.</p>}{events.map((e: any, i: number) => <div key={i} className="flex min-w-0 items-start gap-3"><span className="mt-0.5 rounded-lg bg-primary/10 p-2 text-primary"><ActivityIcon size={17} /></span><div className="min-w-0"><div className="text-sm font-semibold text-ink">{e.event_type}</div><div className="mt-1 text-xs text-faint">{new Date(e.created_at).toLocaleTimeString()}</div>{e.detail?.path && <div className="mt-1 truncate font-mono text-[10px] text-faint">{e.detail.path}</div>}</div></div>)}</div></div></div>;
}

function Metric({ label, value, icon: Icon, accent, tone }: { label: string; value: number | string; icon: (props: { size?: number; className?: string }) => React.JSX.Element; accent: string; tone: string }) {
  return <div className="card relative py-3"><span className={`absolute right-3.5 top-3.5 rounded-lg p-2 ${tone} ${accent}`}><Icon size={19} /></span><div className="stat-num">{value}</div><div className="stat-label">{label}</div></div>;
}
