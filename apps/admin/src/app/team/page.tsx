import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getTeam } from "@/lib/team";
import { AppShell } from "@/components/AppShell";
import { TeamManager } from "./TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const user = await requirePermission("users", "write");
  const team = await withTenant(user.tenantId, (c) => getTeam(c, user.tenantId));
  return (
    <AppShell user={user}>
      <div className="mb-5"><h1 className="font-sans text-l font-bold tracking-tight">Team</h1></div>
      <TeamManager team={team} currentUserId={user.userId} />
    </AppShell>
  );
}
