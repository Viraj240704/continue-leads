-- 0003_assets_leads_domains.sql
-- Brand brief + asset library, lead validation/marketplace fields, domain acquisition.

-- ---------------------------------------------------------------------------
-- Brand brief, logo, domain status
-- ---------------------------------------------------------------------------
ALTER TABLE brands ADD COLUMN IF NOT EXISTS brief text NOT NULL DEFAULT '';
ALTER TABLE brands ADD COLUMN IF NOT EXISTS logo_asset_id uuid;
-- provided = operator already owns the domain; purchased = acquired via registrar; pending = to buy
ALTER TABLE brands ADD COLUMN IF NOT EXISTS domain_status text NOT NULL DEFAULT 'provided';

-- ---------------------------------------------------------------------------
-- Brand asset library (logo, documents, images, about-us info)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS brand_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id      uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  kind          text NOT NULL,          -- logo | image | document | about | other
  filename      text NOT NULL DEFAULT '',
  content_type  text NOT NULL DEFAULT 'application/octet-stream',
  size_bytes    int  NOT NULL DEFAULT 0,
  storage_key   text,                   -- key in the storage adapter (binary assets)
  text_content  text NOT NULL DEFAULT '', -- extracted/typed text (about-us, doc notes) used by generation
  meta          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS brand_assets_brand_idx ON brand_assets(brand_id, kind);

ALTER TABLE brands
  ADD CONSTRAINT brands_logo_asset_fk FOREIGN KEY (logo_asset_id) REFERENCES brand_assets(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Lead validation + marketplace / sale fields
-- ---------------------------------------------------------------------------
ALTER TABLE leads ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'pending'; -- pending|valid|invalid|review
ALTER TABLE leads ADD COLUMN IF NOT EXISTS validation jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS quality_score int NOT NULL DEFAULT 0;             -- 0..100
ALTER TABLE leads ADD COLUMN IF NOT EXISTS price_usd numeric NOT NULL DEFAULT 0;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sale_status text NOT NULL DEFAULT 'new';           -- new|for_sale|sold|rejected
ALTER TABLE leads ADD COLUMN IF NOT EXISTS buyer text NOT NULL DEFAULT '';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS sold_at timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS service_interest text NOT NULL DEFAULT '';

-- ---------------------------------------------------------------------------
-- Domain acquisition records (simulated registrar)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS domain_registrations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id     uuid REFERENCES brands(id) ON DELETE CASCADE,
  domain       text NOT NULL,
  status       text NOT NULL DEFAULT 'checked',  -- checked | registered | failed
  provider     text NOT NULL DEFAULT 'mock-registrar',
  price_usd    numeric NOT NULL DEFAULT 0,
  info         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS domain_registrations_brand_idx ON domain_registrations(brand_id);

-- ---------------------------------------------------------------------------
-- RLS for new tenant-scoped tables (same policy shape as 0002)
-- ---------------------------------------------------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['brand_assets','domain_registrations']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      CREATE POLICY tenant_isolation ON %I
      USING (
        current_setting('app.bypass_rls', true) = 'on'
        OR tenant_id IS NULL
        OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
      )
      WITH CHECK (
        current_setting('app.bypass_rls', true) = 'on'
        OR tenant_id IS NULL
        OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
      );
    $f$, t);
  END LOOP;
END $$;
