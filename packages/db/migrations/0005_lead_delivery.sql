-- 0005_lead_delivery.sql — buyer-facing lead delivery via unguessable token.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivery_token text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS delivered_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS leads_delivery_token_idx ON leads(delivery_token) WHERE delivery_token IS NOT NULL;
