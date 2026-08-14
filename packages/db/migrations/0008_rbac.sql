-- 0008_rbac.sql — role-based access control: canonical roles, org domain, invites.

-- Canonical roles: admin | ops | sales | dev  (+ platform_admin for the operator).
-- Migrate legacy values.
UPDATE users SET role = 'admin'  WHERE role IN ('operator', 'owner', 'admin');
UPDATE users SET role = 'ops'    WHERE role IN ('reviewer', 'ops');
UPDATE users SET role = 'dev'    WHERE role NOT IN ('admin', 'ops', 'sales', 'dev', 'platform_admin');

ALTER TABLE users
  ADD CONSTRAINT users_role_chk
  CHECK (role IN ('admin', 'ops', 'sales', 'dev', 'platform_admin')) NOT VALID;

-- Org domain + join policy live on the tenant.
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS org_domain text NOT NULL DEFAULT '';
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_join  boolean NOT NULL DEFAULT false;

-- Backfill org_domain from the first admin's email domain where unset.
UPDATE tenants t SET org_domain = sub.dom
FROM (
  SELECT tenant_id, lower(split_part(email, '@', 2)) AS dom
  FROM users WHERE role = 'admin'
) sub
WHERE t.id = sub.tenant_id AND (t.org_domain IS NULL OR t.org_domain = '');

-- Invitations (domain-scoped). Email must match the tenant's org_domain (enforced in app).
CREATE TABLE IF NOT EXISTS invites (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email       text NOT NULL,
  role        text NOT NULL DEFAULT 'ops' CHECK (role IN ('admin', 'ops', 'sales', 'dev')),
  token       text NOT NULL,
  status      text NOT NULL DEFAULT 'pending',  -- pending | accepted | revoked
  invited_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS invites_token_idx ON invites(token);
CREATE INDEX IF NOT EXISTS invites_tenant_idx ON invites(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS invites_pending_email_idx
  ON invites(tenant_id, lower(email)) WHERE status = 'pending';

DO $$
BEGIN
  EXECUTE 'ALTER TABLE invites ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE invites FORCE ROW LEVEL SECURITY';
  EXECUTE $f$
    CREATE POLICY tenant_isolation ON invites
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
