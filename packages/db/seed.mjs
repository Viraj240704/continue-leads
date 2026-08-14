// Seeds a demo tenant, an operator + reviewer user, and the global vertical packs.
// Idempotent: re-running updates rather than duplicating.
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { buildTaxonomyPacks } from "./seed/taxonomy-packs.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env") });
dotenv.config({ path: join(__dirname, "..", "..", ".env.example") });

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });

const OPERATOR = { email: "admin@continueleads.test", password: "ChangeMe!123", name: "Ada Operator", role: "admin" };
const REVIEWER = { email: "reviewer@continueleads.test", password: "ChangeMe!123", name: "Rey Reviewer", role: "ops" };
const THIAGO = { email: "thiago@continueleads.test", password: "Thiagocl@123", name: "Thiago Desouza", role: "admin" };

async function upsertUser(tenantId, u) {
  const hash = await bcrypt.hash(u.password, 12);
  const { rows } = await client.query(
    `INSERT INTO users (tenant_id, email, password_hash, name, role)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, name = EXCLUDED.name, role = EXCLUDED.role
     RETURNING id`,
    [tenantId, u.email, hash, u.name, u.role]
  );
  return rows[0].id;
}

async function main() {
  await client.connect();
  await client.query("SET app.bypass_rls = 'on'");

  // Tenant
  const tenant = (
    await client.query(
      `INSERT INTO tenants (name, slug) VALUES ($1,$2)
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
      ["Continue Leads Demo", "demo"]
    )
  ).rows[0];
  console.log("• tenant:", tenant.id);

  const opId = await upsertUser(tenant.id, OPERATOR);
  const revId = await upsertUser(tenant.id, REVIEWER);
  const thiagoId = await upsertUser(tenant.id, THIAGO);
  console.log("• users:", OPERATOR.email, "/", REVIEWER.email, "/", THIAGO.email);

  // Global vertical packs from JSON + hardcoded taxonomy packs
  const packDir = join(__dirname, "seed", "packs");
  const basePacksByKey = new Map();
  for (const f of readdirSync(packDir).filter((f) => f.endsWith(".json"))) {
    const cfg = JSON.parse(readFileSync(join(packDir, f), "utf8"));
    basePacksByKey.set(cfg.key, cfg);
  }
  const finalPacks = new Map(basePacksByKey);
  for (const cfg of buildTaxonomyPacks(basePacksByKey)) {
    finalPacks.set(cfg.key, cfg);
  }

  for (const cfg of finalPacks.values()) {
    await client.query(
      `INSERT INTO vertical_packs (tenant_id, key, version, name, config)
       VALUES (NULL, $1, $2, $3, $4)
       ON CONFLICT (key, version) DO UPDATE SET name = EXCLUDED.name, config = EXCLUDED.config`,
      [cfg.key, cfg.version, cfg.name, cfg]
    );
    console.log(`• pack: ${cfg.key} v${cfg.version} (${cfg.services.length} services)`);
  }

  console.log("✔ seed complete");
}

main()
  .catch((e) => {
    console.error("✖ seed failed:", e.message);
    process.exit(1);
  })
  .finally(() => client.end());
