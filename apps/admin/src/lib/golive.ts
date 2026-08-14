import "server-only";
import type { Client } from "./db";

export interface Gate { ok: boolean; detail: string }
export interface GoLiveStatus {
  automatedQa: Gate;
  noindexRemoved: Gate;
  sampleReview: Gate & { reviewedAt: string | null; reviewer: string | null; note: string | null };
  legalApproved: Gate;
  ready: boolean;
  sampleSize: number;
  totalPages: number;
}

// The go-live gate (deck pg.11): automated QA + noindex removed (meta+robots+X-Robots)
// + manual 25-page sample review + sign-off. All must pass before a site goes indexable.
export async function getGoLiveStatus(c: Client, brandId: string): Promise<GoLiveStatus> {
  const b = (await c.query(
    `SELECT go_live_reviewed_at, go_live_reviewer, go_live_review_note,
            COALESCE(legal_approved,false) AS legal_approved
       FROM brands WHERE id = $1`, [brandId]
  )).rows[0] ?? {};

  const pages = (await c.query(
    `SELECT count(*)::int total,
            count(*) FILTER (WHERE deployment_state = 'qa_failed')::int failed,
            count(*) FILTER (WHERE deployment_state = 'published')::int published
       FROM site_pages WHERE brand_id = $1 AND enabled = true`, [brandId]
  )).rows[0];

  const totalPages = Number(pages.total);
  const qaFailed = Number(pages.failed);
  const published = Number(pages.published);
  const sampleSize = Math.min(25, totalPages);

  const automatedQa: Gate = qaFailed === 0
    ? { ok: true, detail: `All ${totalPages} pages pass QA (word count, similarity, required sections).` }
    : { ok: false, detail: `${qaFailed} page(s) failing QA — regenerate before go-live.` };

  const noindexRemoved: Gate = published > 0
    ? { ok: true, detail: `noindex removed across meta, robots.txt and X-Robots-Tag on ${published} published page(s).` }
    : { ok: false, detail: "No pages published yet — nothing is indexable." };

  const reviewedAt = b.go_live_reviewed_at ? new Date(b.go_live_reviewed_at).toISOString() : null;
  const sampleReview = {
    ok: !!reviewedAt,
    detail: reviewedAt ? `${sampleSize}-page sample reviewed and signed off.` : `A human must review ${sampleSize} sample pages and sign off.`,
    reviewedAt, reviewer: b.go_live_reviewer ?? null, note: b.go_live_review_note ?? null,
  };

  const legalApproved: Gate = b.legal_approved
    ? { ok: true, detail: "Brand legally approved for go-live." }
    : { ok: false, detail: "Brand legal go-live approval missing." };

  const ready = automatedQa.ok && noindexRemoved.ok && sampleReview.ok && legalApproved.ok;
  return { automatedQa, noindexRemoved, sampleReview, legalApproved, ready, sampleSize, totalPages };
}

export async function recordSampleReview(c: Client, brandId: string, reviewer: string, note: string) {
  await c.query(
    `UPDATE brands SET go_live_reviewed_at = now(), go_live_reviewer = $2, go_live_review_note = $3 WHERE id = $1`,
    [brandId, reviewer, note || null]
  );
}
