-- 0001_init.sql — Continue Leads Phase 1 core schema
-- Faithful to build spec §7 "Minimum data model" plus auth/tenancy (Phase 0 foundation).

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector

-- ---------------------------------------------------------------------------
-- Tenancy + auth (reused Phase 0 foundation)
-- ---------------------------------------------------------------------------
CREATE TABLE tenants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL UNIQUE,
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE users (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email          text NOT NULL,
  password_hash  text NOT NULL,
  name           text NOT NULL DEFAULT '',
  role           text NOT NULL DEFAULT 'operator', -- operator | reviewer | platform_admin
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email)
);

CREATE TABLE sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  token       text NOT NULL UNIQUE,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sessions_user_idx ON sessions(user_id);

-- ---------------------------------------------------------------------------
-- Versioned vertical / product packs
-- ---------------------------------------------------------------------------
CREATE TABLE vertical_packs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid REFERENCES tenants(id) ON DELETE CASCADE, -- NULL => global pack
  key         text NOT NULL,          -- e.g. 'painting'
  version     int  NOT NULL DEFAULT 1,
  name        text NOT NULL,
  config      jsonb NOT NULL,         -- taxonomy, blueprints, claims, vocabulary, imagery rules
  status      text NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (key, version)
);

-- ---------------------------------------------------------------------------
-- Brands
-- ---------------------------------------------------------------------------
CREATE TABLE brands (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name              text NOT NULL,
  slug              text NOT NULL,
  vertical_pack_id  uuid NOT NULL REFERENCES vertical_packs(id),
  template_family   text NOT NULL,     -- 'aurora' | 'meridian' | ...
  domain            text NOT NULL,
  profile           jsonb NOT NULL DEFAULT '{}'::jsonb, -- voice, palette, typography, contact, analytics, services, locations
  status            text NOT NULL DEFAULT 'draft',      -- draft | active | paused
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

-- ---------------------------------------------------------------------------
-- Rollout policy
-- ---------------------------------------------------------------------------
CREATE TABLE site_rollout_policies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id       uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  version        int  NOT NULL DEFAULT 1,
  launch_size    int  NOT NULL DEFAULT 8,     -- 6-10 pages indexable at launch
  weekly_targets jsonb NOT NULL DEFAULT '[6,8,12,17]'::jsonb,
  growth_factor  numeric NOT NULL DEFAULT 1.15,
  jitter_bound   numeric NOT NULL DEFAULT 0.15, -- +/- multiplier bound => 0.85..1.15
  daily_cap      int  NOT NULL DEFAULT 3,
  timezone       text NOT NULL DEFAULT 'America/New_York',
  pause_rules    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, version)
);

-- ---------------------------------------------------------------------------
-- Pages (deployment state and indexing state kept SEPARATE — spec §7 rule)
-- ---------------------------------------------------------------------------
CREATE TABLE site_pages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id          uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_type         text NOT NULL,   -- HOME|SERVICE|CITY|MONEY|FAQ|ABOUT|CONTACT|PRIVACY|TERMS|TCPA
  path              text NOT NULL,   -- canonical URL path, e.g. /services/interior-painting
  title             text NOT NULL,
  context           jsonb NOT NULL DEFAULT '{}'::jsonb, -- service, city, priority inputs
  priority          int  NOT NULL DEFAULT 100,
  depends_on        uuid[] NOT NULL DEFAULT '{}',
  deployment_state  text NOT NULL DEFAULT 'draft',
    -- draft|generating|generated|qa_failed|previewed|approved|scheduled|published|paused|rolled_back
  indexing_state    text NOT NULL DEFAULT 'noindex',   -- noindex | indexable
  current_version_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, path)
);
CREATE INDEX site_pages_brand_idx ON site_pages(brand_id);

-- ---------------------------------------------------------------------------
-- Page versions (structured typed blocks, not a single HTML string)
-- ---------------------------------------------------------------------------
CREATE TABLE page_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id           uuid NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  version           int  NOT NULL,
  blocks            jsonb NOT NULL,   -- typed content blocks
  metadata          jsonb NOT NULL DEFAULT '{}'::jsonb, -- title, description, canonical
  schema_payload    jsonb NOT NULL DEFAULT '{}'::jsonb, -- JSON-LD
  content_hash      text NOT NULL,    -- exact-duplicate detection
  assets            jsonb NOT NULL DEFAULT '[]'::jsonb,
  render_uri        text,             -- storage path of rendered HTML
  template_version  text NOT NULL DEFAULT 'v1',
  gen_metadata      jsonb NOT NULL DEFAULT '{}'::jsonb, -- model, prompt version, pack version, seed
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, version)
);

-- ---------------------------------------------------------------------------
-- Generation jobs (async, idempotent, retryable)
-- ---------------------------------------------------------------------------
CREATE TABLE generation_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_id          uuid REFERENCES site_pages(id) ON DELETE CASCADE,
  page_version_id  uuid REFERENCES page_versions(id) ON DELETE SET NULL,
  batch_id         uuid NOT NULL,
  kind             text NOT NULL DEFAULT 'page',
  status           text NOT NULL DEFAULT 'queued', -- queued|running|succeeded|failed|dead
  model            text NOT NULL DEFAULT 'mock-claude',
  prompt_version   text NOT NULL DEFAULT 'v1',
  estimate_cost    numeric NOT NULL DEFAULT 0,
  actual_cost      numeric NOT NULL DEFAULT 0,
  attempts         int NOT NULL DEFAULT 0,
  max_attempts     int NOT NULL DEFAULT 3,
  error            text,
  idempotency_key  text UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX generation_jobs_status_idx ON generation_jobs(status);
CREATE INDEX generation_jobs_batch_idx ON generation_jobs(batch_id);

-- ---------------------------------------------------------------------------
-- QA
-- ---------------------------------------------------------------------------
CREATE TABLE qa_runs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_version_id  uuid NOT NULL REFERENCES page_versions(id) ON DELETE CASCADE,
  status           text NOT NULL,  -- pass | warn | fail
  summary          jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE qa_findings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  qa_run_id   uuid NOT NULL REFERENCES qa_runs(id) ON DELETE CASCADE,
  check_key   text NOT NULL,
  severity    text NOT NULL,   -- blocking | warning | info
  message     text NOT NULL,
  evidence    jsonb NOT NULL DEFAULT '{}'::jsonb,
  resolved    boolean NOT NULL DEFAULT false
);
CREATE INDEX qa_findings_run_idx ON qa_findings(qa_run_id);

-- ---------------------------------------------------------------------------
-- Embeddings (meaningful body vector for the current content version)
-- ---------------------------------------------------------------------------
CREATE TABLE page_embeddings (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_version_id  uuid NOT NULL REFERENCES page_versions(id) ON DELETE CASCADE,
  source_hash      text NOT NULL,
  embedding        vector(256) NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_version_id)
);

-- ---------------------------------------------------------------------------
-- Approvals
-- ---------------------------------------------------------------------------
CREATE TABLE approvals (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  page_id           uuid REFERENCES site_pages(id) ON DELETE CASCADE,
  page_version_id   uuid REFERENCES page_versions(id) ON DELETE CASCADE,
  reviewer_user_id  uuid NOT NULL REFERENCES users(id),
  scope             text NOT NULL DEFAULT 'page', -- page | batch
  decision          text NOT NULL,                -- approved | rejected | regenerate
  notes             text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Progressive publishing
-- ---------------------------------------------------------------------------
CREATE TABLE publish_schedule (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_id          uuid NOT NULL REFERENCES site_pages(id) ON DELETE CASCADE,
  page_version_id  uuid NOT NULL REFERENCES page_versions(id) ON DELETE CASCADE,
  wave             int NOT NULL,
  scheduled_at     timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'scheduled', -- scheduled|publishing|published|failed|paused
  attempts         int NOT NULL DEFAULT 0,
  reason           text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (page_id, wave)
);
CREATE INDEX publish_schedule_brand_idx ON publish_schedule(brand_id, scheduled_at);

CREATE TABLE publish_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id      uuid REFERENCES brands(id) ON DELETE CASCADE,
  page_id       uuid REFERENCES site_pages(id) ON DELETE SET NULL,
  event_type    text NOT NULL,  -- generated|approved|scheduled|published|paused|rolled_back|cost|qa
  actor_user_id uuid REFERENCES users(id),
  from_version  int,
  to_version    int,
  detail        jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX publish_events_brand_idx ON publish_events(brand_id, created_at);

CREATE TABLE site_manifests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id         uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  version          int NOT NULL,
  entries          jsonb NOT NULL DEFAULT '{}'::jsonb, -- { path: page_version_id }
  indexable_paths  jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_live          boolean NOT NULL DEFAULT false,
  note             text NOT NULL DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (brand_id, version)
);
CREATE INDEX site_manifests_live_idx ON site_manifests(brand_id, is_live);

-- ---------------------------------------------------------------------------
-- Leads (minimal capture contract; buyer matching is Phase 2)
-- ---------------------------------------------------------------------------
CREATE TABLE leads (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  brand_id           uuid NOT NULL REFERENCES brands(id) ON DELETE CASCADE,
  page_path          text NOT NULL DEFAULT '',
  payload_encrypted  text NOT NULL,               -- encrypted PII
  utm                jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent            jsonb NOT NULL DEFAULT '{}'::jsonb, -- text, timestamp, ip
  source             jsonb NOT NULL DEFAULT '{}'::jsonb,
  dedupe_key         text NOT NULL UNIQUE,         -- ensures exactly-once
  status             text NOT NULL DEFAULT 'captured',
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_brand_idx ON leads(brand_id, created_at);

-- Foreign key from site_pages.current_version_id (added after page_versions exists)
ALTER TABLE site_pages
  ADD CONSTRAINT site_pages_current_version_fk
  FOREIGN KEY (current_version_id) REFERENCES page_versions(id) ON DELETE SET NULL;
