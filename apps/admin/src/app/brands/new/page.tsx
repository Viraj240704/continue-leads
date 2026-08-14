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
      <div className="mb-5"><h1 className="font-sans text-l font-bold tracking-tight">New site</h1></div>
      <Wizard packs={packData} />
    </AppShell>
  );
}
