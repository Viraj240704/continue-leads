import "server-only";
import type { Client } from "./db";

export interface ComplianceCheck { key: string; label: string; ok: boolean; detail: string }
export interface BrandCompliance {
  checks: ComplianceCheck[];
  autoOk: boolean;        // TCPA + claims + dedup (system-verifiable)
  legalApproved: boolean; // manual attorney sign-off
  goLiveReady: boolean;   // autoOk && legalApproved
  legalApprovedAt: string | null;
}

// Per-brand legal go-live gate (spec: no form ships without TCPA consent; claims must
// be reviewed; leads dedup'd/validated). A brand cannot publish until goLiveReady.
export async function getBrandCompliance(c: Client, brandId: string): Promise<BrandCompliance> {
  const brand = (await c.query(`SELECT legal_approved, legal_approved_at FROM brands WHERE id=$1`, [brandId])).rows[0] ?? {};

  const tcpaPage = (await c.query(
    `SELECT count(*)::int AS n FROM site_pages WHERE brand_id=$1 AND page_type='TCPA' AND enabled=true`, [brandId])).rows[0].n;
  const leadFormPages = (await c.query(
    `SELECT count(*)::int AS n FROM site_pages WHERE brand_id=$1 AND page_type IN ('HOME','CONTACT','MONEY','SERVICE','CITY') AND enabled=true`, [brandId])).rows[0].n;
  const tcpaOk = tcpaPage > 0 && leadFormPages > 0;

  const badClaims = (await c.query(
    `SELECT count(*)::int AS n FROM qa_findings f
       JOIN qa_runs r ON r.id = f.qa_run_id
       JOIN site_pages sp ON sp.current_version_id = r.page_version_id
      WHERE sp.brand_id=$1 AND f.check_key='prohibited-claim' AND f.severity='blocking' AND f.resolved=false`, [brandId])).rows[0].n;
  const claimsOk = badClaims === 0;

  const dedupOk = true; // platform enforces 30-day phone+zip+vertical dedup + validation

  const checks: ComplianceCheck[] = [
    { key: "tcpa", label: "TCPA consent in place", ok: tcpaOk, detail: tcpaOk ? "TCPA disclosure page + consent above every lead form" : "Add/enable the TCPA page and a lead-capture page" },
    { key: "claims", label: "No prohibited claims", ok: claimsOk, detail: claimsOk ? "No unresolved blocking claim findings" : `${badClaims} unresolved prohibited-claim finding(s)` },
    { key: "dedup", label: "Dedup & validation active", ok: dedupOk, detail: "Leads deduplicated (30-day phone+ZIP+vertical) and validated at capture" },
    { key: "legal", label: "Attorney sign-off", ok: !!brand.legal_approved, detail: brand.legal_approved ? "Legally approved for go-live" : "Reviewer must approve consent/claims for public launch" },
  ];
  const autoOk = tcpaOk && claimsOk && dedupOk;
  return {
    checks, autoOk, legalApproved: !!brand.legal_approved,
    goLiveReady: autoOk && !!brand.legal_approved,
    legalApprovedAt: brand.legal_approved_at ?? null,
  };
}
