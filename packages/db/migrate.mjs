// Minimal forward-only migration runner. Applies packages/db/migrations/*.sql in order,
// tracked in _migrations. `--reset` drops the public schema first (local dev only).
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env") });
dotenv.config({ path: join(__dirname, "..", "..", ".env.example") }); // fallback defaults

const RESET = process.argv.includes("--reset");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  await client.query("SET app.bypass_rls = 'on'");

  if (RESET) {
    console.log("• Resetting schema (DROP SCHEMA public CASCADE)…");
    await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
  }

  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const dir = join(__dirname, "migrations");
  const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
  const done = new Set(
    (await client.query("SELECT name FROM _migrations")).rows.map((r) => r.name)
  );

  for (const f of files) {
    if (done.has(f)) {
      console.log(`• skip   ${f}`);
      continue;
    }
    console.log(`• apply  ${f}`);
    const sql = readFileSync(join(dir, f), "utf8");
    await client.query("BEGIN");
    try {
      await client.query("SET LOCAL app.bypass_rls = 'on'");
      await client.query(sql);
      await client.query("INSERT INTO _migrations(name) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    }
  }
  console.log("✔ migrations up to date");
}

main()
  .catch((e) => {
    console.error("✖ migration failed:", e.message);
    process.exit(1);
  })
  .finally(() => client.end());
