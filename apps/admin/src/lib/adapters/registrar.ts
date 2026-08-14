import "server-only";
import { hashString } from "../rng";

// Domain registrar adapter. The local driver is a SIMULATION — it never contacts a
// real registrar and never spends money. A real driver (e.g. Route53 Domains / a
// registrar API) would implement the same interface. Actual purchases are out of
// scope and must be performed by a human with a funded account.
export interface DomainQuote {
  domain: string;
  available: boolean;
  priceUsd: number;
  currency: string;
  suggestions: { domain: string; available: boolean; priceUsd: number }[];
}
export interface DomainRegistrar {
  readonly provider: string;
  readonly simulated: boolean;
  check(domain: string): Promise<DomainQuote>;
  register(domain: string): Promise<{ ok: boolean; priceUsd: number; info: Record<string, unknown> }>;
}

const TLD_PRICE: Record<string, number> = { com: 12.99, net: 14.99, co: 29.99, io: 44.99, org: 13.99, us: 9.99 };

function normalize(domain: string): { host: string; tld: string } {
  const host = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const tld = host.includes(".") ? host.split(".").pop()! : "com";
  return { host: host.includes(".") ? host : `${host}.com`, tld };
}

class MockRegistrar implements DomainRegistrar {
  readonly provider = "mock-registrar";
  readonly simulated = true;

  private isAvailable(host: string): boolean {
    // Deterministic: ~65% of names are "available". A short curated list is always taken.
    const taken = new Set(["google.com", "amazon.com", "test.com", "example.com", "painting.com", "roofing.com"]);
    if (taken.has(host)) return false;
    return hashString(host) % 100 < 65;
  }
  private price(tld: string): number {
    return TLD_PRICE[tld] ?? 19.99;
  }

  async check(domain: string): Promise<DomainQuote> {
    const { host, tld } = normalize(domain);
    const base = host.replace(/\.[^.]+$/, "");
    const suggestions = ["net", "co", "io", "us"].map((t) => ({
      domain: `${base}.${t}`,
      available: this.isAvailable(`${base}.${t}`),
      priceUsd: this.price(t),
    }));
    // If the exact name is taken, offer prefixed alternates that are available.
    if (!this.isAvailable(host)) {
      for (const pre of ["get", "the", "go", "my"]) {
        const alt = `${pre}${base}.${tld}`;
        suggestions.unshift({ domain: alt, available: this.isAvailable(alt), priceUsd: this.price(tld) });
      }
    }
    return {
      domain: host,
      available: this.isAvailable(host),
      priceUsd: this.price(tld),
      currency: "USD",
      suggestions: suggestions.slice(0, 5),
    };
  }

  async register(domain: string) {
    const { host, tld } = normalize(domain);
    if (!this.isAvailable(host)) return { ok: false, priceUsd: 0, info: { reason: "unavailable" } };
    // Simulated registration — no real transaction occurs.
    return {
      ok: true,
      priceUsd: this.price(tld),
      info: { simulated: true, registeredAt: new Date().toISOString(), autoRenew: true, privacy: true },
    };
  }
}

let _r: DomainRegistrar | null = null;
export function getRegistrar(): DomainRegistrar {
  return (_r ??= new MockRegistrar());
}
