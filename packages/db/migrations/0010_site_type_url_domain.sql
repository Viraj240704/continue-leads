-- 0010_site_type_url_domain.sql — BDW site type, money-page URL strategy, domain connect.

ALTER TABLE brands ADD COLUMN IF NOT EXISTS site_type         text NOT NULL DEFAULT 'local';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS url_pattern       text NOT NULL DEFAULT '/services/{service}/{city}';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS domain_verified_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS dns_target        text;

ALTER TABLE brands
  ADD CONSTRAINT brands_site_type_chk
  CHECK (site_type IN ('micro','local','regional','franchise','national')) NOT VALID;
