import "server-only";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { withSystem } from "./db";
import { env } from "./env";

const COOKIE = "cl_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h (spec: Expires=12h)

export type SessionUser = {
  userId: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
};

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export async function login(email: string, password: string): Promise<SessionUser | null> {
  const user = await withSystem(async (c) => {
    const { rows } = await c.query(
      "SELECT id, tenant_id, email, name, role, password_hash FROM users WHERE lower(email) = lower($1) LIMIT 1",
      [email]
    );
    return rows[0];
  });
  if (!user) return null;
  if (!(await verifyPassword(password, user.password_hash))) return null;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_TTL_MS);
  await withSystem(async (c) => {
    await c.query(
      "INSERT INTO sessions (user_id, tenant_id, token, expires_at) VALUES ($1,$2,$3,$4)",
      [user.id, user.tenant_id, token, expires]
    );
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // env-driven — fixes the Phase-0 hardcoded `secure:false` bug. HTTPS prod sets COOKIE_SECURE=true.
    secure: env.cookieSecure,
    path: "/",
    expires,
  });

  return {
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export async function getSession(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  return withSystem(async (c) => {
    const { rows } = await c.query(
      `SELECT u.id, u.tenant_id, u.email, u.name, u.role
         FROM sessions s JOIN users u ON u.id = s.user_id
        WHERE s.token = $1 AND s.expires_at > now() LIMIT 1`,
      [token]
    );
    const u = rows[0];
    if (!u) return null;
    return { userId: u.id, tenantId: u.tenant_id, email: u.email, name: u.name, role: u.role };
  });
}

export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await withSystem((c) => c.query("DELETE FROM sessions WHERE token = $1", [token]));
  }
  jar.delete(COOKIE);
}

/** Throws (via redirect at call site) if no session. Returns the authenticated user. */
export async function requireUser(): Promise<SessionUser> {
  const s = await getSession();
  if (!s) throw new Error("UNAUTHENTICATED");
  return s;
}
