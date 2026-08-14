-- 0006_buyers.sql — first-class buyers + lead assignment.
CREATE TABLE IF NOT EXISTS buyers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name          text NOT NULL,
  company       text NOT NULL DEFAULT '',
  email         text NOT NULL DEFAULT '',
  phone         text NOT NULL DEFAULT '',
  status        text NOT NULL DEFAULT 'active',      -- active | inactive
  access_token  text NOT NULL,                       -- unguessable portal key
  notes         text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS buyers_access_token_idx ON buyers(access_token);
CREATE INDEX IF NOT EXISTS buyers_tenant_idx ON buyers(tenant_id);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS buyer_id uuid REFERENCES buyers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS leads_buyer_idx ON leads(buyer_id);

-- RLS (same policy shape as 0002)
DO $$
BEGIN
  EXECUTE 'ALTER TABLE buyers ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE buyers FORCE ROW LEVEL SECURITY';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON buyers
    USING (
      current_setting('app.bypass_rls', true) = 'on'
      OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    )
    WITH CHECK (
      current_setting('app.bypass_rls', true) = 'on'
      OR tenant_id = nullif(current_setting('app.tenant_id', true), '')::uuid
    );
  $f$;
END $$;
