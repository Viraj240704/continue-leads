import "server-only";
import type { Client } from "./db";
import { getStorage, storageKeys } from "./adapters/storage";

export interface AssetRow {
  id: string;
  brand_id: string;
  kind: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  storage_key: string | null;
  text_content: string;
  created_at: string;
}

export async function createAsset(
  c: Client,
  opts: {
    tenantId: string; brandId: string; brandSlug: string;
    kind: "logo" | "image" | "document" | "about" | "other";
    filename?: string; contentType?: string; bytes?: Buffer; textContent?: string;
  }
): Promise<AssetRow> {
  const row = await c.query(
    `INSERT INTO brand_assets (tenant_id, brand_id, kind, filename, content_type, size_bytes, text_content)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [opts.tenantId, opts.brandId, opts.kind, opts.filename ?? "", opts.contentType ?? "text/plain",
     opts.bytes?.length ?? 0, opts.textContent ?? ""]
  );
  const id = row.rows[0].id as string;

  if (opts.bytes && opts.bytes.length) {
    const key = storageKeys.asset(opts.brandSlug, id);
    await getStorage().putBytes(key, opts.bytes, opts.contentType);
    await c.query(`UPDATE brand_assets SET storage_key = $1 WHERE id = $2`, [key, id]);
  }
  // If this is the first logo, set it as the brand logo automatically.
  if (opts.kind === "logo") {
    await c.query(`UPDATE brands SET logo_asset_id = $1 WHERE id = $2`, [id, opts.brandId]);
  }
  return (await c.query(`SELECT * FROM brand_assets WHERE id = $1`, [id])).rows[0];
}

export async function listAssets(c: Client, brandId: string): Promise<AssetRow[]> {
  return (await c.query(`SELECT * FROM brand_assets WHERE brand_id = $1 ORDER BY created_at DESC`, [brandId])).rows;
}

export async function getAsset(c: Client, assetId: string): Promise<AssetRow | null> {
  return (await c.query(`SELECT * FROM brand_assets WHERE id = $1`, [assetId])).rows[0] ?? null;
}

export async function deleteAsset(c: Client, brandId: string, assetId: string) {
  const a = await getAsset(c, assetId);
  if (!a) return;
  if (a.storage_key) await getStorage().remove(a.storage_key);
  await c.query(`UPDATE brands SET logo_asset_id = NULL WHERE logo_asset_id = $1`, [assetId]);
  await c.query(`DELETE FROM brand_assets WHERE id = $1 AND brand_id = $2`, [assetId, brandId]);
}

export async function setBrandLogo(c: Client, brandId: string, assetId: string) {
  await c.query(`UPDATE brands SET logo_asset_id = $1 WHERE id = $2`, [assetId, brandId]);
}

// Text the operator supplied (about-us + typed document notes) that generation can use.
export async function getBrandSuppliedText(c: Client, brandId: string): Promise<string> {
  const { rows } = await c.query(
    `SELECT text_content FROM brand_assets WHERE brand_id = $1 AND kind IN ('about','document') AND text_content <> '' ORDER BY created_at`,
    [brandId]
  );
  return rows.map((r) => r.text_content).join("\n\n").trim();
}

// Logo as a data URI for embedding directly in rendered HTML (keeps pages self-contained).
export async function getLogoDataUri(c: Client, brandId: string): Promise<string | null> {
  const { rows } = await c.query(
    `SELECT a.storage_key, a.content_type FROM brands b JOIN brand_assets a ON a.id = b.logo_asset_id WHERE b.id = $1`,
    [brandId]
  );
  const a = rows[0];
  if (!a?.storage_key) return null;
  const bytes = await getStorage().getBytes(a.storage_key);
  if (!bytes) return null;
  return `data:${a.content_type};base64,${bytes.toString("base64")}`;
}
