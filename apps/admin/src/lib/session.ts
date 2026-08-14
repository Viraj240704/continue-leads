import "server-only";
import { redirect } from "next/navigation";
import { getSession, type SessionUser } from "./auth";
import { can, isRole, type Action, type Resource, type Role } from "./rbac";

/** For server components: returns the user or redirects to /login. */
export async function requireSession(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) redirect("/login");
  return s;
}

/** Normalize a possibly-legacy role string to a canonical Role. */
export function roleOf(user: SessionUser): Role {
  return isRole(user.role) ? user.role : "dev";
}

/**
 * For server components: require a permission or bounce to /home.
 * Returns the session user so pages can keep using it.
 */
export async function requirePermission(resource: Resource, action: Action = "read"): Promise<SessionUser> {
  const user = await requireSession();
  if (!can(roleOf(user), resource, action)) redirect("/home");
  return user;
}
