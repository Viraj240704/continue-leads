import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { listBuyers } from "@/lib/buyers";
import { AppShell } from "@/components/AppShell";
import { BuyersPageBody } from "./BuyersUI";

export const dynamic = "force-dynamic";

export default async function BuyersPage() {
  const user = await requirePermission("buyers", "read");
  const buyers = await withTenant(user.tenantId, (c) => listBuyers(c));

  return (
    <AppShell user={user}>
      <BuyersPageBody buyers={buyers} />
    </AppShell>
  );
}
