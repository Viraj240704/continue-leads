import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { listBuyers } from "@/lib/buyers";
import { AppShell } from "@/components/AppShell";
import { CreateBuyerForm, ApprovalPill } from "./BuyersUI";

export const dynamic = "force-dynamic";

export default async function BuyersPage() {
  const user = await requirePermission("buyers", "read");
  const buyers = await withTenant(user.tenantId, (c) => listBuyers(c));

  return (
    <AppShell user={user}>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="eyebrow mb-1">Demand side</p>
          <h1 className="font-display text-2xl font-bold">Buyers</h1>
          <p className="text-sm text-dim">Companies that purchase your leads. Each buyer gets a private portal link to view what they&apos;ve bought.</p>
        </div>
        <CreateBuyerForm />
      </div>

      {buyers.length === 0 ? (
        <div className="card text-dim">No buyers yet. Add one, or create one on the fly when selling a lead.</div>
      ) : (
        <div className="data-table overflow-x-auto rounded-[var(--r-lg)] border border-line">
          <table className="w-full border-collapse">
            <thead className="bg-raised/40"><tr>
              <th className="th">Buyer</th><th className="th">Status</th><th className="th">Company</th>
              <th className="th">Leads</th><th className="th">Sold</th><th className="th">Spend</th><th className="th"></th>
            </tr></thead>
            <tbody>
              {buyers.map((b: any) => (
                <tr key={b.id} className="border-t border-line/60">
                  <td className="td font-semibold">{b.name}</td>
                  <td className="td"><ApprovalPill status={b.approval_status} /></td>
                  <td className="td text-dim">{b.company || "—"}</td>
                  <td className="td">{b.lead_count}</td>
                  <td className="td">{b.sold_count}</td>
                  <td className="td font-semibold text-amber">${Number(b.spend).toFixed(2)}</td>
                  <td className="td text-right"><Link href={`/buyers/${b.id}`} className="text-xs text-accent hover:underline">manage ↗</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AppShell>
  );
}
