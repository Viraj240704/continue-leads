import "server-only";
import { promises as dns } from "dns";
import type { Client } from "./db";

// The CNAME/ALIAS target a customer points their domain at. Sites are served from
// the CDN behind the *.sites wildcard, so each site gets a stable subdomain target.
export function dnsTargetFor(slug: string): string {
  const base = process.env.SITES_BASE_DOMAIN || "sites.continueleads.com";
  return `${slug}.${base}`;
}

export interface DomainStatus {
  domain: string;
  target: string;
  recordType: "CNAME";
  verified: boolean;
  verifiedAt: string | null;
  detail: string;
}

export async function getDomainStatus(c: Client, brandId: string): Promise<DomainStatus | null> {
  const b = (await c.query(`SELECT slug, domain, domain_verified_at FROM brands WHERE id = $1`, [brandId])).rows[0];
  if (!b) return null;
  const target = dnsTargetFor(b.slug);
  return {
    domain: b.domain,
    target,
    recordType: "CNAME",
    verified: !!b.domain_verified_at,
    verifiedAt: b.domain_verified_at ? new Date(b.domain_verified_at).toISOString() : null,
    detail: b.domain_verified_at ? "DNS points to the CDN." : "Add the record below, then click Verify.",
  };
}

// Poll DNS: does the domain's CNAME resolve to our target? (Apex domains may use ALIAS/ANAME.)
export async function verifyDomain(c: Client, brandId: string): Promise<{ ok: boolean; detail: string }> {
  const b = (await c.query(`SELECT slug, domain FROM brands WHERE id = $1`, [brandId])).rows[0];
  if (!b) return { ok: false, detail: "Site not found." };
  const target = dnsTargetFor(b.slug);
  const host = String(b.domain).replace(/^https?:\/\//, "").replace(/\/$/, "");
  try {
    let matched = false;
    try {
      const cnames = await dns.resolveCname(host);
      matched = cnames.some((c2) => c2.replace(/\.$/, "") === target);
    } catch { /* no CNAME — try apex A/ALIAS resolution below */ }
    if (!matched) {
      // Apex: compare resolved A records against the target's A records.
      try {
        const [domA, tgtA] = await Promise.all([dns.resolve4(host), dns.resolve4(target)]);
        matched = domA.some((ip) => tgtA.includes(ip));
      } catch { /* ignore */ }
    }
    if (matched) {
      await c.query(`UPDATE brands SET domain_verified_at = now(), dns_target = $2, domain_status = 'connected' WHERE id = $1`, [brandId, target]);
      return { ok: true, detail: "Verified — DNS resolves to the CDN." };
    }
    return { ok: false, detail: `Not detected yet. ${host} does not resolve to ${target}. DNS can take up to 48h to propagate.` };
  } catch (e: any) {
    return { ok: false, detail: `Lookup failed: ${e?.code ?? e?.message ?? "error"}. The record may not be published yet.` };
  }
}
