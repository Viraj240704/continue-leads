// Polls the database until it accepts connections (used by `pnpm setup`).
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", "..", ".env") });
dotenv.config({ path: join(__dirname, "..", "..", ".env.example") });

const url = process.env.DATABASE_URL;
const deadline = Date.now() + 60_000;

async function tryOnce() {
  const c = new pg.Client({ connectionString: url });
  try {
    await c.connect();
    await c.query("SELECT 1");
    await c.end();
    return true;
  } catch {
    try { await c.end(); } catch {}
    return false;
  }
}

while (Date.now() < deadline) {
  if (await tryOnce()) {
    console.log("✔ database is ready");
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 1500));
  process.stdout.write(".");
}
console.error("\n✖ database not ready after 60s");
process.exit(1);
