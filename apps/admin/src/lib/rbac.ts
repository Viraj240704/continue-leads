// Role-based access control. Permission matrix from the vendor spec (pg. 4).
// Resources are coarse-grained; actions are read | write.

export type Role = "platform_admin" | "admin" | "ops" | "sales" | "dev";
export type Resource = "sites" | "pages" | "leads" | "buyers" | "users" | "settings";
export type Action = "read" | "write";

export const ROLES: Role[] = ["platform_admin", "admin", "ops", "sales", "dev"];

export const ROLE_LABELS: Record<Role, string> = {
  platform_admin: "Platform Admin",
  admin: "Admin",
  ops: "Ops",
  sales: "Sales",
  dev: "Dev",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  platform_admin: "Full read/write across all customer accounts.",
  admin: "Full read/write on this account, including team & settings.",
  ops: "Works leads day-to-day. Read-only on sites & buyers.",
  sales: "Reads leads & buyers. No site access.",
  dev: "Reads sites & pages. No lead or buyer access.",
};

// Roles a Customer Admin may assign when inviting (platform_admin is not assignable here).
export const ASSIGNABLE_ROLES: Role[] = ["admin", "ops", "sales", "dev"];

type Perm = "R" | "RW" | "-";
// [resource]: per-role grant. platform_admin is RW everywhere (handled in can()).
const MATRIX: Record<Resource, Partial<Record<Role, Perm>>> = {
  sites:    { admin: "RW", ops: "R",  sales: "R", dev: "R" },
  pages:    { admin: "RW", ops: "R",  sales: "-", dev: "R" },
  leads:    { admin: "RW", ops: "RW", sales: "R", dev: "R" },
  buyers:   { admin: "RW", ops: "R",  sales: "R", dev: "-" },
  users:    { admin: "RW", ops: "-",  sales: "-", dev: "-" },
  settings: { admin: "RW", ops: "-",  sales: "-", dev: "-" },
};

export function can(role: Role, resource: Resource, action: Action = "read"): boolean {
  if (role === "platform_admin") return true;
  const grant = MATRIX[resource]?.[role] ?? "-";
  if (grant === "RW") return true;
  if (grant === "R") return action === "read";
  return false;
}

export function isRole(v: string): v is Role {
  return (ROLES as string[]).includes(v);
}

// ---- Navigation model, grouped BMP / LMP, filtered by permission ------------
export interface NavItem {
  href: string;
  label: string;
  resource: Resource;
  action?: Action; // permission needed to SEE the item (default read)
}
export interface NavGroup {
  key: "bmp" | "lmp" | "settings";
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    key: "bmp",
    label: "Brand Management",
    items: [
      { href: "/dashboard", label: "Sites", resource: "sites" },
      { href: "/brands/new", label: "New site", resource: "sites", action: "write" },
      { href: "/templates", label: "Templates", resource: "sites" },
      { href: "/freshness", label: "Freshness", resource: "pages" },
      { href: "/analytics", label: "Analytics", resource: "sites" },
    ],
  },
  {
    key: "lmp",
    label: "Lead Management",
    items: [
      { href: "/leads", label: "Leads", resource: "leads" },
      { href: "/buyers", label: "Buyers", resource: "buyers" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    items: [{ href: "/team", label: "Team", resource: "users", action: "write" }],
  },
];

// Groups with only the items this role may see (empty groups dropped).
export function navFor(role: Role): NavGroup[] {
  return NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => can(role, i.resource, i.action ?? "read")) }))
    .filter((g) => g.items.length > 0);
}
