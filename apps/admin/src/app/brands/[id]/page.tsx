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
import { WaveRail } from "@/components/WaveRail";
import { PipelineBar } from "./Actions";
import { Manage } from "./Manage";
import { PagesTable } from "./PagesTable";
import { SchedulePanel } from "./SchedulePanel";

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
    const waves = (await c.query(
      `SELECT ps.page_id, ps.wave, ps.status, ps.scheduled_at, sp.path
         FROM publish_schedule ps JOIN site_pages sp ON sp.id = ps.page_id
        WHERE ps.brand_id = $1 ORDER BY ps.wave, ps.scheduled_at`, [id])).rows;
    const events = (await c.query(
      `SELECT event_type, detail, created_at FROM publish_events WHERE brand_id = $1 ORDER BY created_at DESC LIMIT 12`, [id])).rows;
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
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="eyebrow mb-1">Site console</p>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">{brand.name}</h1>
            <StatePill state={brand.status} />
          </div>
          <div className="mt-1.5 flex items-center gap-3">
            <p className="mono text-sm text-faint">{brand.domain} · {brand.template_family}</p>
            <WaveRail total={pages.length} live={counts.published ?? 0} sched={counts.scheduled ?? 0} count={18} />
          </div>
        </div>
        <Link href="/dashboard" className="btn-ghost">← All brands</Link>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Metric label="Pages" value={pages.length} />
        <Metric label="Generated" value={(counts.generated ?? 0) + (counts.approved ?? 0) + (counts.scheduled ?? 0) + (counts.published ?? 0)} />
        <Metric label="Approved+" value={(counts.approved ?? 0) + (counts.scheduled ?? 0) + (counts.published ?? 0)} />
        <Metric label="Published" value={counts.published ?? 0} />
        <Metric label="QA pass" value={`${qaPass}/${qaTotal || 0}`} />
        <Metric label="Gen cost" value={`$${Number(cost).toFixed(2)}`} />
      </div>

      <div className="mb-6">
        <h2 className="mb-2 font-semibold">Brand inputs — provide before generating</h2>
        <Manage brandId={brand.id} brief={brand.brief} domain={brand.domain} domainStatus={brand.domain_status}
          logoAssetId={brand.logo_asset_id} assets={assets as any} />
      </div>

      <div className="mb-6"><Compliance brandId={brand.id} compliance={compliance} /></div>

      <div className="mb-6"><PipelineBar brandId={brand.id} status={brand.status} /></div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <h2 className="mb-2 font-semibold">Pages</h2>
          <PagesTable brandId={brand.id} brandSlug={brand.slug} pages={pages as any} />

          {manifest && (
            <p className="mt-2 text-xs text-faint">
              Live manifest <b>v{manifest.version}</b> · {manifest.indexable_paths?.length ?? 0} indexable ·{" "}
              <a className="text-accent hover:underline" href={`/live/${brand.slug}`} target="_blank">view live site ↗</a> ·{" "}
              <a className="text-accent hover:underline" href={`/live/${brand.slug}/sitemap.xml`} target="_blank">sitemap</a> · {leads} lead(s)
            </p>
          )}
        </section>

        <aside className="space-y-6">
          <GoLiveChecklist brandId={brand.id} status={goLive} canWrite={canWriteSites} />
          <BlogPanel brandId={brand.id} domain={brand.domain} config={blogConfig} canWrite={canWriteSites} />
          {domainStatus && <DomainConnect brandId={brand.id} status={domainStatus} canWrite={canWriteSites} />}
          <div>
            <h2 className="mb-2 font-semibold">Publish schedule</h2>
            <SchedulePanel brandId={brand.id} waves={waves as any} />
          </div>

          <div>
            <h2 className="mb-2 font-semibold">Audit log</h2>
            <div className="card space-y-2">
              {events.length === 0 && <p className="text-sm text-dim">No events yet.</p>}
              {events.map((e: any, i: number) => (
                <div key={i} className="text-xs">
                  <span className="font-semibold text-dim">{e.event_type}</span>{" "}
                  <span className="text-dim">{new Date(e.created_at).toLocaleTimeString()}</span>
                  {e.detail?.path && <span className="ml-1 font-mono text-faint">{e.detail.path}</span>}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  const accent = label === "Published" || label === "Gen cost";
  return (
    <div className="card py-3">
      <div className="stat-num" style={accent ? { color: "var(--amber)" } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
