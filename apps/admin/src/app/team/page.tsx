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
      <div className="mb-6">
        <p className="eyebrow mb-1">Settings</p>
        <h1 className="font-sans text-2xl font-bold">Team</h1>
        <p className="text-sm text-dim">
          Invite teammates on the <span className="mono">@{team.orgDomain || "your-domain"}</span> domain and assign their role.
        </p>
      </div>
      <TeamManager team={team} currentUserId={user.userId} />
    </AppShell>
  );
}
