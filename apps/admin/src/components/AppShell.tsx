import type { SessionUser } from "@/lib/auth";
import { ROLE_LABELS, isRole, navFor } from "@/lib/rbac";
import { withTenant } from "@/lib/db";
import { getNotifications } from "@/lib/notifications";
import { DashboardShell } from "./DashboardShell";
import type { NavLink } from "./Sidebar";

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("") || "U";
}

export async function AppShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const role = isRole(user.role) ? user.role : "dev";
  const notifs = await withTenant(user.tenantId, (c) => getNotifications(c, role)).catch(() => []);

  // Flat nav list with Homepage first, then every permitted app section.
  const navItems: NavLink[] = [
    { href: "/home", label: "Homepage" },
    ...navFor(role).flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label }))),
  ];

  return (
    <DashboardShell
      navItems={navItems}
      notifs={notifs}
      user={{ name: user.name, email: user.email, department: ROLE_LABELS[role], roleLabel: ROLE_LABELS[role], initials: initials(user.name) }}
    >
      {children}
    </DashboardShell>
  );
}

// Pills live in a client-safe module (AppShell imports server-only code).
export { StatePill, IndexPill, QaPill } from "./Pills";
