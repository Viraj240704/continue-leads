-- 0007_compliance.sql — buyer onboarding/approval gate + brand legal go-live gate.

-- Buyer contract terms + approval (gate A: onboarded before we can sell to them)
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending'; -- pending|approved|rejected
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS verticals text[] NOT NULL DEFAULT '{}';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS geos text[] NOT NULL DEFAULT '{}';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS bid_floor numeric NOT NULL DEFAULT 0;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS dedup_policy text NOT NULL DEFAULT '30-day phone+zip+vertical';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS delivery_endpoint text NOT NULL DEFAULT '';
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS terms_accepted boolean NOT NULL DEFAULT false;
ALTER TABLE buyers ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Brand legal go-live sign-off (gate B: form/consent legally cleared before selling)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS legal_approved boolean NOT NULL DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS legal_approved_by uuid REFERENCES users(id);
ALTER TABLE brands ADD COLUMN IF NOT EXISTS legal_approved_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS compliance_notes text NOT NULL DEFAULT '';
