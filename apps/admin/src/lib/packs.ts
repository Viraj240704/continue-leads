import "server-only";
import type { Client } from "./db";
import type { VerticalPackConfig } from "./types";

export interface PackRow {
  id: string;
  key: string;
  version: number;
  name: string;
  config: VerticalPackConfig;
}

export async function listPacks(c: Client): Promise<PackRow[]> {
  const { rows } = await c.query(
    "SELECT id, key, version, name, config FROM vertical_packs WHERE status = 'active' ORDER BY name"
  );
  return rows as PackRow[];
}

export async function getPack(c: Client, id: string): Promise<PackRow | null> {
  const { rows } = await c.query(
    "SELECT id, key, version, name, config FROM vertical_packs WHERE id = $1",
    [id]
  );
  return (rows[0] as PackRow) ?? null;
}
