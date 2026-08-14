import "server-only";
import type { Client } from "./db";

export interface SearchResults {
  brands: { id: string; name: string; domain: string }[];
  buyers: { id: string; name: string; company: string }[];
  pages: { id: string; brand_id: string; path: string; brand_name: string }[];
  leads: { id: string; service_interest: string; brand_name: string; sale_status: string }[];
}

// Lightweight global search (ILIKE). Lead contact PII is encrypted and not searchable.
export async function globalSearch(c: Client, q: string): Promise<SearchResults> {
  const like = `%${q}%`;
  const [brands, buyers, pages, leads] = await Promise.all([
    c.query(`SELECT id, name, domain FROM brands WHERE name ILIKE $1 OR domain ILIKE $1 ORDER BY name LIMIT 12`, [like]),
    c.query(`SELECT id, name, company FROM buyers WHERE name ILIKE $1 OR company ILIKE $1 ORDER BY name LIMIT 12`, [like]),
    c.query(`SELECT sp.id, sp.brand_id, sp.path, b.name AS brand_name FROM site_pages sp JOIN brands b ON b.id=sp.brand_id
             WHERE sp.path ILIKE $1 OR sp.title ILIKE $1 ORDER BY sp.path LIMIT 12`, [like]),
    c.query(`SELECT l.id, l.service_interest, b.name AS brand_name, l.sale_status FROM leads l JOIN brands b ON b.id=l.brand_id
             WHERE l.service_interest ILIKE $1 OR l.page_path ILIKE $1 OR l.buyer ILIKE $1 ORDER BY l.created_at DESC LIMIT 12`, [like]),
  ]);
  return { brands: brands.rows, buyers: buyers.rows, pages: pages.rows, leads: leads.rows };
}
