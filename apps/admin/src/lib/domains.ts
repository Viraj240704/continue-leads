import "server-only";
import type { Client } from "./db";
import { getRegistrar } from "./adapters/registrar";
import { audit } from "./audit";

export async function checkDomain(domain: string) {
  return getRegistrar().check(domain);
}

export async function purchaseDomain(
  c: Client,
  opts: { tenantId: string; brandId?: string; domain: string; actorUserId: string }
): Promise<{ ok: boolean; reason?: string; priceUsd?: number; simulated: boolean }> {
  const reg = getRegistrar();
  const res = await reg.register(opts.domain);
  await c.query(
    `INSERT INTO domain_registrations (tenant_id, brand_id, domain, status, provider, price_usd, info)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [opts.tenantId, opts.brandId ?? null, opts.domain, res.ok ? "registered" : "failed", reg.provider, res.priceUsd, res.info]
  );
  if (!res.ok) return { ok: false, reason: "Domain unavailable", simulated: reg.simulated };

  if (opts.brandId) {
    await c.query(`UPDATE brands SET domain = $1, domain_status = 'purchased' WHERE id = $2`, [opts.domain, opts.brandId]);
    await audit(c, { tenantId: opts.tenantId, brandId: opts.brandId, eventType: "cost", actorUserId: opts.actorUserId, detail: { domainPurchased: opts.domain, priceUsd: res.priceUsd, simulated: reg.simulated } });
  }
  return { ok: true, priceUsd: res.priceUsd, simulated: reg.simulated };
}
