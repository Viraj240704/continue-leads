-- 0004_page_brief_enable.sql — per-page brief override and per-page enable/disable.
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS brief text NOT NULL DEFAULT '';
ALTER TABLE site_pages ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS site_pages_enabled_idx ON site_pages(brand_id, enabled);
