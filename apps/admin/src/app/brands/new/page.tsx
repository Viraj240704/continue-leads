import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { listPacks } from "@/lib/packs";
import { AppShell } from "@/components/AppShell";
import { Wizard } from "./Wizard";

export const dynamic = "force-dynamic";

export default async function NewBrandPage() {
  const user = await requirePermission("sites", "write");
  const packs = await withTenant(user.tenantId, (c) => listPacks(c));
  const packData = packs.map((p) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    services: p.config.services,
    blueprints: p.config.pageBlueprints.map((b) => ({ scope: b.scope })),
  }));

  return (
    <AppShell user={user}>
      <p className="eyebrow mb-1">New build</p>
      <h1 className="mb-1 font-display text-2xl font-bold">New brand & site</h1>
      <p className="mb-6 text-sm text-dim">
        Configure the brand, pick a product, services and geography, and review the generation-cost estimate before creating the page plan. The design is assigned automatically.
      </p>
      <Wizard packs={packData} />
    </AppShell>
  );
}
