import "server-only";
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { withSystem, type Client } from "./db";
import { ASSIGNABLE_ROLES, type Role } from "./rbac";

export interface TeamMember { id: string; name: string; email: string; role: string }
export interface TeamInvite { id: string; email: string; role: string; status: string; token: string; createdAt: string }
export interface TeamData {
  orgDomain: string;
  autoJoin: boolean;
  members: TeamMember[];
  invites: TeamInvite[];
}

function domainOf(email: string) { return email.trim().toLowerCase().split("@")[1] ?? ""; }

export async function getTeam(c: Client, tenantId: string): Promise<TeamData> {
  const t = (await c.query(`SELECT org_domain, auto_join FROM tenants WHERE id = $1`, [tenantId])).rows[0];
  const members = (await c.query(
    `SELECT id, name, email, role FROM users ORDER BY created_at ASC`
  )).rows as TeamMember[];
  const invites = (await c.query(
    `SELECT id, email, role, status, token, created_at FROM invites WHERE status = 'pending' ORDER BY created_at DESC`
  )).rows.map((r) => ({ id: r.id, email: r.email, role: r.role, status: r.status, token: r.token, createdAt: new Date(r.created_at).toISOString() }));
  return { orgDomain: t?.org_domain ?? "", autoJoin: !!t?.auto_join, members, invites };
}

export async function createInvite(
  c: Client, tenantId: string, opts: { email: string; role: Role; invitedBy: string }
): Promise<{ ok: boolean; error?: string; token?: string }> {
  const email = opts.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, error: "Enter a valid email address." };
  if (!ASSIGNABLE_ROLES.includes(opts.role)) return { ok: false, error: "Invalid role." };

  const org = (await c.query(`SELECT org_domain FROM tenants WHERE id = $1`, [tenantId])).rows[0]?.org_domain as string;
  if (org && domainOf(email) !== org.toLowerCase()) {
    return { ok: false, error: `Email must be on the @${org} domain.` };
  }
  const existing = (await c.query(`SELECT 1 FROM users WHERE lower(email) = $1`, [email])).rows[0];
  if (existing) return { ok: false, error: "That person already has an account." };

  const token = randomBytes(24).toString("base64url");
  try {
    await c.query(
      `INSERT INTO invites (tenant_id, email, role, token, invited_by) VALUES ($1,$2,$3,$4,$5)`,
      [tenantId, email, opts.role, token, opts.invitedBy]
    );
  } catch {
    return { ok: false, error: "There's already a pending invite for that email." };
  }
  return { ok: true, token };
}

export async function revokeInvite(c: Client, id: string): Promise<void> {
  await c.query(`UPDATE invites SET status = 'revoked' WHERE id = $1 AND status = 'pending'`, [id]);
}

export async function setAutoJoin(c: Client, tenantId: string, value: boolean): Promise<void> {
  await c.query(`UPDATE tenants SET auto_join = $2 WHERE id = $1`, [tenantId, value]);
}

export async function changeUserRole(c: Client, userId: string, role: Role): Promise<{ ok: boolean; error?: string }> {
  if (!ASSIGNABLE_ROLES.includes(role)) return { ok: false, error: "Invalid role." };
  await c.query(`UPDATE users SET role = $2 WHERE id = $1`, [userId, role]);
  return { ok: true };
}

// ---- Invite acceptance (cross-tenant lookup by token) -----------------------
export async function getInviteByToken(token: string) {
  return withSystem(async (c) => {
    const r = (await c.query(
      `SELECT i.id, i.tenant_id, i.email, i.role, i.status, t.name AS org_name
         FROM invites i JOIN tenants t ON t.id = i.tenant_id
        WHERE i.token = $1`, [token]
    )).rows[0];
    return r ?? null;
  });
}

export async function acceptInvite(
  token: string, name: string, password: string
): Promise<{ ok: boolean; error?: string }> {
  if (name.trim().length < 2) return { ok: false, error: "Enter your name." };
  if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
  return withSystem(async (c) => {
    const inv = (await c.query(`SELECT * FROM invites WHERE token = $1`, [token])).rows[0];
    if (!inv || inv.status !== "pending") return { ok: false, error: "This invite is no longer valid." };
    const dup = (await c.query(`SELECT 1 FROM users WHERE lower(email) = lower($1)`, [inv.email])).rows[0];
    if (dup) { await c.query(`UPDATE invites SET status='accepted', accepted_at=now() WHERE id=$1`, [inv.id]); return { ok: false, error: "An account already exists for this email — please sign in." }; }
    const hash = await bcrypt.hash(password, 10);
    await c.query(
      `INSERT INTO users (tenant_id, email, name, role, password_hash) VALUES ($1,$2,$3,$4,$5)`,
      [inv.tenant_id, inv.email, name.trim(), inv.role, hash]
    );
    await c.query(`UPDATE invites SET status='accepted', accepted_at=now() WHERE id=$1`, [inv.id]);
    return { ok: true };
  });
}
