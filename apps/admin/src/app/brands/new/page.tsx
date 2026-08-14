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
      <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-0.5">New build</p>
      <h1 className="mb-0.5 font-display text-xl font-bold text-ink">New brand & site</h1>
      <p className="mb-4 text-xs text-dim">
        Configure your brand, services, and target geography. Review the estimate before creating the page plan.
      </p>
      <Wizard packs={packData} />
    </AppShell>
  );
}
