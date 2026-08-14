-- 0009_lead_lifecycle.sql — unified lead lifecycle history + return capability.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS returned_at   timestamptz;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS return_reason text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rejected_at   timestamptz;

-- Timestamped status transitions (NEW -> VALIDATED -> SOLD / REJECTED / RETURNED).
CREATE TABLE IF NOT EXISTS lead_status_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  lead_id       uuid NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  from_status   text,
  to_status     text NOT NULL,
  note          text,
  actor_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS lead_status_events_lead_idx ON lead_status_events(lead_id, created_at);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE lead_status_events ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE lead_status_events FORCE ROW LEVEL SECURITY';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON lead_status_events
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
