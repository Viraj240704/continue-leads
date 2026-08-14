import Link from "next/link";
import { requireSession, roleOf } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getHomeMetrics } from "@/lib/home";
import { AppShell } from "@/components/AppShell";
import { ActivityIcon, AnalyticsIcon, BuildingIcon, ChevronRightIcon, EyeIcon, MapPinIcon, TagIcon, TeamIcon, TemplatesIcon, UploadIcon } from "@/components/Icons";

export const dynamic = "force-dynamic";

type Icon = (props: { size?: number; className?: string }) => React.JSX.Element;

function MetricCard({ label, value, sub, trend, icon: Icon, tone, iconTone = "text-primary", brand }: { label: string; value: string; sub?: string; trend?: string; icon: Icon; tone: string; iconTone?: string; brand?: boolean }) {
  if (brand || label === "Page visits") {
    return (
      <div className="card grid h-[120px] grid-cols-[56px_1fr] items-center gap-3 px-5">
        <div className={`grid h-14 w-14 place-items-center rounded-xl ${tone}`}><Icon size={28} className={iconTone} /></div>
        <div className="min-w-0">
          <div className="text-[22px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
          <div className="mt-2 text-sm font-semibold text-ink">{label}</div>
          {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
          {trend && label !== "Page visits" && <span className="mt-1 block text-xs font-semibold text-ok">{trend}</span>}
        </div>
      </div>
    );
  }

  return (
    <div className="card flex items-center gap-4 px-4 py-2 sm:px-5 sm:py-3">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-[var(--r-lg)] ${tone}`}><Icon size={22} className="text-primary" /></div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2"><div className="text-[24px] font-bold leading-none tracking-tight tabular-nums">{value}</div>{trend && <span className="text-xs font-semibold text-ok">{trend}</span>}</div>
        <div className="mt-1.5 text-sm font-semibold text-ink">{label}</div>
        {sub && <div className="mt-1 text-xs text-faint">{sub}</div>}
      </div>
    </div>
  );
}

function LeadCard({ label, value, description = "No leads yet.", icon: Icon, tone, iconTone }: { label: string; value: string; description?: string; icon: Icon; tone: string; iconTone: string }) {
  return (
    <div className="card grid h-full min-h-0 grid-cols-[56px_1fr_auto] items-center gap-3 px-5 py-2">
      <div className={`grid h-14 w-14 place-items-center rounded-xl ${tone}`}><Icon size={28} className={iconTone} /></div>
      <div className="min-w-0">
        <div className="text-[22px] font-bold leading-none tracking-tight tabular-nums">{value}</div>
        <div className="mt-2 text-sm font-semibold text-ink">{label}</div>
        <div className="mt-1 text-xs text-faint">{description}</div>
      </div>
      <ChevronRightIcon size={18} className="text-dim" />
    </div>
  );
}

const demoLeads = [
  { name: "John Carter", location: "Denver, CO", zip: "80202", status: "New", tone: "bg-primary/10 text-primary", dot: "bg-primary" },
  { name: "Sarah Wilson", location: "Austin, TX", zip: "73301", status: "Contacted", tone: "bg-primary/10 text-primary", dot: "bg-primary" },
  { name: "Michael Lee", location: "Phoenix, AZ", zip: "85001", status: "Qualified", tone: "bg-ok/10 text-ok", dot: "bg-ok" },
  { name: "Emma Davis", location: "Miami, FL", zip: "33101", status: "Pending", tone: "bg-warn/10 text-warn", dot: "bg-warn" },
  { name: "Noah Martin", location: "Chicago, IL", zip: "60601", status: "New", tone: "bg-primary/10 text-primary", dot: "bg-primary" },
  { name: "James Anderson", location: "Seattle, WA", zip: "98101", status: "Contacted", tone: "bg-primary/10 text-primary", dot: "bg-primary" },
];

const activity = ["New site added", "ZIP ranking updated", "Lead imported", "Template published", "Analytics synced"];

export default async function HomePage() {
  const user = await requireSession();
  const role = roleOf(user);
  const m = await withTenant(user.tenantId, (c) => getHomeMetrics(c));
  const showBMP = role !== "sales";
  const showLMP = role !== "dev";

  return <AppShell user={user}>
    <div className="mb-5"><h1 className="font-sans text-l font-bold tracking-tight">Homepage</h1></div>

    {showBMP && <section className="mb-5"><div className="mb-2 flex items-center gap-2"><span className="text-sm font-medium text-dim">Brand management</span></div><div className="grid gap-3 sm:grid-cols-3">
      <MetricCard label="Sites live" value={String(m.sitesLive)} sub="Active websites currently published." icon={BuildingIcon} tone="bg-primary/10" iconTone="text-primary" brand />
      <MetricCard label="Active ZIP codes" value={String(m.activeZips)} sub="ZIPs with ranking pages" icon={MapPinIcon} tone="bg-info/10" iconTone="text-info" brand />
      <MetricCard label="Page visits" value="1,248" sub="Today: +42 · This week: +186" icon={EyeIcon} tone="bg-ok/10" iconTone="text-ok" />
    </div></section>}

    {showLMP && <section className="mb-5"><div className="mb-2 flex items-center gap-2"><span className="text-sm font-medium text-dim">Lead management</span></div><div className="grid gap-3 lg:grid-cols-[260px_1fr]">
      <div className="grid gap-3 lg:h-full lg:grid-rows-3"><LeadCard label="Leads today" value={String(m.leadsToday)} icon={ActivityIcon} tone="bg-primary/10" iconTone="text-primary" /><LeadCard label="Leads by category" value={String(m.leadsByCategory.reduce((sum, row) => sum + row.count, 0))} icon={TagIcon} tone="bg-warn/10" iconTone="text-warn" /><LeadCard label="New buyers" value="0" description="No new buyers yet." icon={TeamIcon} tone="bg-info/10" iconTone="text-info" /></div>
      <div className="card overflow-hidden p-3 sm:p-4"><div className="mb-3 flex items-center justify-between"><div className="section-title">Recent leads</div><Link href="/leads" className="text-xs text-primary hover:underline">View all →</Link></div><div className="overflow-x-auto rounded-md border border-line"><table className="w-full min-w-[520px] text-sm"><thead className="bg-canvas text-left text-xs text-faint"><tr><th className="px-3 py-2 font-medium">Lead</th><th className="px-3 py-2 font-medium">Location</th><th className="px-3 py-2 font-medium">ZIP</th><th className="px-3 py-2 font-medium">Status</th></tr></thead><tbody className="divide-y divide-line">{demoLeads.map((lead) => <tr key={lead.name}><td className="px-3 py-2.5 font-medium">{lead.name}</td><td className="px-3 py-2.5 text-dim">{lead.location}</td><td className="mono px-3 py-2.5 text-xs text-dim">{lead.zip}</td><td className="px-3 py-2.5"><span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${lead.tone}`}><span className={`h-1.5 w-1.5 rounded-full ${lead.dot}`} />{lead.status}</span></td></tr>)}</tbody></table></div></div>
    </div></section>}

    <section className="grid gap-3 lg:grid-cols-2">
      <div className="card h-[184px] overflow-hidden p-3"><div className="section-title mb-4">Quick actions</div><div className="grid gap-2 sm:grid-cols-2"><Link href="/new-site" className="btn-ghost justify-start"><BuildingIcon size={17} className="text-primary" />New site</Link><Link href="/leads" className="btn-ghost justify-start"><UploadIcon size={17} className="text-info" />Import leads</Link><Link href="/sites" className="btn-ghost justify-start"><TemplatesIcon size={17} className="text-warn" />View sites</Link><Link href="/analytics" className="btn-ghost justify-start"><AnalyticsIcon size={17} className="text-ok" />View analytics</Link></div></div>
      <div className="card h-[184px] overflow-hidden p-3"><div className="section-title mb-4">Recent activity</div><div className="h-[112px] overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"><ul className="space-y-3">{activity.slice(0, 3).map((item, index) => <li key={item} className="flex items-center gap-3 text-sm"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{index + 1}</span><span className="text-dim">{item}</span><span className="ml-auto text-xs text-faint">Recently</span></li>)}</ul></div></div>
    </section>
  </AppShell>;
}
