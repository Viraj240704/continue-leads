-- 0012_blog.sql — per-site blog configuration (enable, cadence, URL structure, topics).
ALTER TABLE brands ADD COLUMN IF NOT EXISTS blog_config jsonb NOT NULL DEFAULT '{"enabled": false}'::jsonb;
