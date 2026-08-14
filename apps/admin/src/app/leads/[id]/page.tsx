import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/session";
import { withTenant } from "@/lib/db";
import { getLeadFull } from "@/lib/leads-admin";
import { getStatusHistory } from "@/lib/lead-lifecycle";
import { deriveLifecycle, LIFECYCLE_LABELS, LIFECYCLE_TONE } from "@/lib/lead-lifecycle-types";
import { AppShell } from "@/components/AppShell";
import { env } from "@/lib/env";
import { ValidationPill, SalePill, QualityBar, LeadRowActions, DeliveryLink } from "../Market";
import { ReturnControl } from "./ReturnControl";

export const dynamic = "force-dynamic";

export default async function LeadDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requirePermission("leads", "read");
  const { lead, buyers, history } = await withTenant(user.tenantId, async (c) => ({
    lead: await getLeadFull(c, id),
    buyers: await (await import("@/lib/buyers")).listApprovedBuyers(c),
    history: await getStatusHistory(c, id),
  }));
  if (!lead) notFound();

  const checks: any[] = lead.validation?.checks ?? [];
  const lifecycle = deriveLifecycle({ validation_status: lead.validationStatus, sale_status: lead.saleStatus, returned_at: lead.returnedAt, rejected_at: lead.rejectedAt });

  return (
    <AppShell user={user}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">Lead detail</h1>
          <span className={`pill ${LIFECYCLE_TONE[lifecycle]}`}>{LIFECYCLE_LABELS[lifecycle]}</span>
        </div>
        <Link href="/leads" className="btn-ghost">← All leads</Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="card">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="font-semibold">Contact</h2>
              <span className="text-xs text-dim">(full detail — buyer receives this on purchase)</span>
            </div>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-sm">
              <dt className="text-faint">Name</dt><dd>{lead.contact.name || "—"}</dd>
              <dt className="text-faint">Phone</dt><dd className="font-mono">{lead.contact.phone || "—"}</dd>
              <dt className="text-faint">Email</dt><dd className="font-mono">{lead.contact.email || "—"}</dd>
              <dt className="text-faint">Message</dt><dd>{lead.contact.message || "—"}</dd>
              <dt className="text-faint">Brand</dt><dd>{lead.brandName}</dd>
              <dt className="text-faint">Interest</dt><dd>{lead.serviceInterest || "—"}</dd>
              <dt className="text-faint">Source page</dt><dd className="font-mono text-xs">{lead.pagePath || "—"}</dd>
            </dl>
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Validation checks</h2>
            <ul className="space-y-1 text-sm">
              {checks.map((c: any, i: number) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={c.ok ? "text-ok" : "text-bad"}>{c.ok ? "✓" : "✗"}</span>
                  <span className="w-28 text-faint">{c.key}</span>
                  <span>{c.note}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h2 className="mb-2 font-semibold">Consent & attribution</h2>
            <dl className="grid grid-cols-[120px_1fr] gap-y-2 text-xs">
              <dt className="text-faint">Consent text</dt><dd>{lead.consent?.text ?? "—"}</dd>
              <dt className="text-faint">Captured</dt><dd>{lead.consent?.timestamp ?? "—"}</dd>
              <dt className="text-faint">IP</dt><dd className="font-mono">{lead.consent?.ip ?? "—"}</dd>
              <dt className="text-faint">UTM</dt><dd className="font-mono">{JSON.stringify(lead.utm ?? {})}</dd>
            </dl>
          </div>

          <div className="card">
            <h2 className="mb-3 font-semibold">Status history</h2>
            {history.length === 0 ? (
              <p className="text-sm text-faint">No transitions recorded yet.</p>
            ) : (
              <ol className="relative space-y-3 border-l border-line pl-4">
                {history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="flex items-center gap-2 text-sm">
                      <span className={`pill ${LIFECYCLE_TONE[(h.to as keyof typeof LIFECYCLE_TONE)] ?? "bg-faint/12 text-dim"}`}>
                        {(LIFECYCLE_LABELS as any)[h.to] ?? h.to}
                      </span>
                      {h.from && <span className="text-xs text-faint">from {(LIFECYCLE_LABELS as any)[h.from] ?? h.from}</span>}
                    </div>
                    {h.note && <p className="mt-0.5 text-xs text-dim">{h.note}</p>}
                    <p className="text-xs text-faint">{new Date(h.at).toLocaleString("en-US", { timeZone: "UTC" })}{h.actor ? ` · ${h.actor}` : ""}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="card space-y-3">
            <Row k="Validation" v={<ValidationPill status={lead.validationStatus} />} />
            <Row k="Quality" v={<QualityBar score={lead.qualityScore} />} />
            <Row k="Suggested price" v={<span className="text-lg font-bold">{lead.priceUsd > 0 ? `$${lead.priceUsd.toFixed(2)}` : "—"}</span>} />
            <Row k="Sale status" v={<SalePill status={lead.saleStatus} />} />
            {lead.buyer && <Row k="Buyer" v={<span>{lead.buyer}</span>} />}
            {lead.saleStatus === "sold" && lead.buyerName && (
              <Row k="Buyer" v={<a className="text-accent hover:underline" href={`/buyers/${lead.buyerId}`}>{lead.buyerName}</a>} />
            )}
            <div className="border-t border-line pt-3">
              <LeadRowActions lead={{ id: lead.id, sale_status: lead.saleStatus, validation_status: lead.validationStatus }} buyers={buyers} />
            </div>
            {lifecycle === "sold" && (
              <div className="border-t border-line pt-3">
                <ReturnControl leadId={lead.id} />
              </div>
            )}
          </div>

          {lead.saleStatus === "sold" && lead.deliveryToken && (
            <div className="card">
              <p className="eyebrow mb-2">Buyer delivery</p>
              <DeliveryLink url={`${env.baseUrl}/deliver/${lead.deliveryToken}`} />
              <p className="mt-2 text-xs text-dim">
                {lead.deliveredAt ? `Opened by buyer ${new Date(lead.deliveredAt).toLocaleString()}` : "Not yet opened by buyer."}
              </p>
              {lead.buyerToken && (
                <p className="mt-2 text-xs">
                  <a className="text-accent hover:underline" href={`${env.baseUrl}/portal/${lead.buyerToken}`} target="_blank" rel="noreferrer">Open buyer portal ↗</a>
                </p>
              )}
            </div>
          )}
        </aside>
      </div>
    </AppShell>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex items-center justify-between text-sm"><span className="text-faint">{k}</span>{v}</div>;
}
