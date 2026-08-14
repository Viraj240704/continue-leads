import Link from "next/link";
import { requireSession } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { globalSearch } from "@/lib/search";
import { AppShell } from "@/components/AppShell";

export const dynamic = "force-dynamic";

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const user = await requireSession();
  const q = (await searchParams).q?.trim() ?? "";
  const r = q ? await withTenant(user.tenantId, (c) => globalSearch(c, q)) : { brands: [], buyers: [], pages: [], leads: [] };
  const count = r.brands.length + r.buyers.length + r.pages.length + r.leads.length;

  return (
    <AppShell user={user}>
      <div className="mb-6">
        <p className="eyebrow mb-1">Search</p>
        <h1 className="font-sans text-2xl font-bold">Results for “{q}”</h1>
        <p className="text-sm text-dim">{count} match{count === 1 ? "" : "es"}</p>
      </div>

      {count === 0 ? (
        <div className="card text-dim">No matches. Try a brand name, domain, page path, service, or buyer.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Group title="Brands" empty={r.brands.length === 0}>
            {r.brands.map((b) => <Row key={b.id} href={`/brands/${b.id}`} title={b.name} sub={b.domain} />)}
          </Group>
          <Group title="Buyers" empty={r.buyers.length === 0}>
            {r.buyers.map((b) => <Row key={b.id} href={`/buyers/${b.id}`} title={b.name} sub={b.company} />)}
          </Group>
          <Group title="Pages" empty={r.pages.length === 0}>
            {r.pages.map((p) => <Row key={p.id} href={`/brands/${p.brand_id}`} title={p.path} sub={p.brand_name} mono />)}
          </Group>
          <Group title="Leads" empty={r.leads.length === 0}>
            {r.leads.map((l) => <Row key={l.id} href={`/leads/${l.id}`} title={l.service_interest || "lead"} sub={`${l.brand_name} · ${l.sale_status}`} />)}
          </Group>
        </div>
      )}
    </AppShell>
  );
}

function Group({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  if (empty) return null;
  return (
    <div>
      <p className="section-title mb-2">{title}</p>
      <div className="panel divide-y divide-line overflow-hidden">{children}</div>
    </div>
  );
}
function Row({ href, title, sub, mono }: { href: string; title: string; sub?: string; mono?: boolean }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-2.5 transition hover:bg-raised">
      <span className={`text-sm font-medium text-ink ${mono ? "font-mono text-xs" : ""}`}>{title}</span>
      {sub && <span className="text-xs text-faint">{sub}</span>}
    </Link>
  );
}
