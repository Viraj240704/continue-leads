-- 0002_rls.sql — Row-Level Security for tenant isolation (spec: "tenant isolation preserved")
--
-- Model: every request runs inside a transaction that does
--   SET LOCAL app.tenant_id = '<uuid>';
-- Rows are visible/writable only when their tenant_id matches (global rows with
-- tenant_id IS NULL are always visible — used for shared vertical packs).
--
-- Migrations and the seeder set app.bypass_rls = 'on' to operate across tenants.
-- FORCE ROW LEVEL SECURITY makes the policy apply even to the table owner.

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users','sessions','vertical_packs','brands','site_rollout_policies',
    'site_pages','page_versions','generation_jobs','qa_runs','qa_findings',
    'page_embeddings','approvals','publish_schedule','publish_events',
    'site_manifests','leads'
  ]
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
