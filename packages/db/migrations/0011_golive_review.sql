-- 0011_golive_review.sql — manual 25-page sample-review sign-off for the go-live gate.
ALTER TABLE brands ADD COLUMN IF NOT EXISTS go_live_reviewed_at timestamptz;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS go_live_reviewer    text;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS go_live_review_note text;
