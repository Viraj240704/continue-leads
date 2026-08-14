import "server-only";
import pg from "pg";
import { env } from "./env";

// Reuse a single pool across Next.js hot reloads.
const g = globalThis as unknown as { __clPool?: pg.Pool };
export const pool: pg.Pool =
  g.__clPool ??
  (g.__clPool = new pg.Pool({ connectionString: env.databaseUrl, max: 8 }));

export type Client = pg.PoolClient;

/**
 * Run a function inside a transaction scoped to one tenant. RLS (0002_rls.sql)
 * restricts every statement to rows where tenant_id matches (or IS NULL).
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (c: Client) => Promise<T>
): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SELECT set_config('app.tenant_id', $1, true)", [tenantId]);
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}

/**
 * System-level access that bypasses RLS. Used only for authentication and
 * session lookups where the tenant is not yet known. Never expose to tenant input.
 */
export async function withSystem<T>(fn: (c: Client) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL app.bypass_rls = 'on'");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
