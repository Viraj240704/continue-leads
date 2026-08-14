import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { listPacks } from "@/lib/packs";
import { AppShell } from "@/components/AppShell";
import { PackImport } from "./PackImport";

export const dynamic = "force-dynamic";

export default async function PackImportPage() {
  const user = await requirePermission("sites", "write");
  const packs = await withTenant(user.tenantId, (c) => listPacks(c));
  return (
    <AppShell user={user}>
      <div className="mb-6">
        <p className="eyebrow mb-1">Configuration</p>
        <h1 className="font-sans text-2xl font-bold">Product packs</h1>
        <p className="text-sm text-dim">Import products and their services from a spreadsheet. Each product becomes a selectable pack in the brand wizard.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <PackImport />
        <div>
          <p className="section-title mb-2">Available packs</p>
          <div className="panel divide-y divide-line overflow-hidden">
            {packs.map((p) => (
              <div key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <span className="text-sm font-medium">{p.name}</span>
                <span className="text-xs text-faint">{p.config.services.length} services</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
