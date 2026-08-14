import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getBuyer } from "@/lib/buyers";
import { listLeads } from "@/lib/leads-admin";
import { env } from "@/lib/env";
import { AppShell } from "@/components/AppShell";
import { SalePill } from "@/app/leads/Market";
import { CopyField, ApprovalControl, ApprovalPill } from "../BuyersUI";

export const dynamic = "force-dynamic";

export default async function BuyerDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("buyers", "read");
  const data = await withTenant(user.tenantId, async (c) => {
    const buyer = await getBuyer(c, id);
    if (!buyer) return null;
    const leads = await listLeads(c, { buyerId: id });
    return { buyer, leads };
  });
  if (!data) notFound();
  const { buyer, leads } = data;
  const spend = leads.filter((l) => l.sale_status === "sold").reduce((s, l) => s + l.price_usd, 0);
  const portalUrl = `${env.baseUrl}/portal/${buyer.access_token}`;

  return (
    <AppShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="eyebrow mb-1">Buyer</p>
          <h1 className="font-display text-2xl font-bold">{buyer.name}</h1>
          <p className="mono text-sm text-faint">{buyer.company || "—"} · {buyer.email || buyer.phone || "no contact"}</p>
        </div>
        <Link href="/buyers" className="btn-ghost">← All buyers</Link>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Purchased leads</h2>
            <a href={`/api/leads/export.csv?buyerId=${buyer.id}`} className="btn-ghost btn-sm">Export CSV</a>
          </div>
          {leads.length === 0 ? (
            <div className="card text-sm text-dim">No leads assigned to this buyer yet.</div>
          ) : (
            <div className="data-table overflow-x-auto rounded-[var(--r-lg)] border border-line">
              <table className="w-full border-collapse">
                <thead className="bg-raised/40"><tr>
                  <th className="th">Sold</th><th className="th">Brand</th><th className="th">Interest</th>
                  <th className="th">Price</th><th className="th">Status</th><th className="th"></th>
                </tr></thead>
                <tbody>
                  {leads.map((l) => (
                    <tr key={l.id} className="border-t border-line/60">
                      <td className="td text-xs text-dim">{l.created_at ? new Date(l.created_at).toLocaleDateString() : "—"}</td>
                      <td className="td text-xs">{l.brand_name}</td>
                      <td className="td text-xs">{l.service_interest || "—"}</td>
                      <td className="td font-semibold">${l.price_usd.toFixed(2)}</td>
                      <td className="td"><SalePill status={l.sale_status} /></td>
                      <td className="td text-right"><Link href={`/leads/${l.id}`} className="text-xs text-accent hover:underline">view</Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className="card">
            <div className="mb-2 flex items-center justify-between">
              <p className="eyebrow">Onboarding</p>
              <ApprovalPill status={buyer.approval_status} />
            </div>
            <dl className="grid grid-cols-[90px_1fr] gap-y-1.5 text-xs">
              <dt className="text-faint">Verticals</dt><dd>{buyer.verticals?.length ? buyer.verticals.join(", ") : "—"}</dd>
              <dt className="text-faint">Geos</dt><dd>{buyer.geos?.length ? buyer.geos.join(", ") : "—"}</dd>
              <dt className="text-faint">Bid floor</dt><dd className="mono">${Number(buyer.bid_floor).toFixed(2)}</dd>
              <dt className="text-faint">Delivery</dt><dd className="mono truncate">{buyer.delivery_endpoint || "—"}</dd>
              <dt className="text-faint">Terms</dt><dd>{buyer.terms_accepted ? "accepted" : "not accepted"}</dd>
            </dl>
            <div className="mt-3"><ApprovalControl buyerId={buyer.id} status={buyer.approval_status} /></div>
          </div>
          <div className="card">
            <p className="stat-label mb-1">Total spend</p>
            <div className="stat-num text-amber">${spend.toFixed(2)}</div>
            <p className="mt-1 text-xs text-faint">{leads.length} lead(s) assigned</p>
          </div>
          <div className="card">
            <p className="eyebrow mb-2">Buyer portal link</p>
            <CopyField url={portalUrl} label="Copy" />
            <p className="mt-2 text-[11px] text-faint">Private link — the buyer sees every lead they&apos;ve purchased. Anyone with the link has access.</p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
