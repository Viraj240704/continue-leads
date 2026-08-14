import { notFound } from "next/navigation";
import { getLeadByDeliveryToken } from "@/lib/leads-admin";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

// Public, token-gated lead delivery receipt for buyers. The token is the authorization —
// no login. Whoever holds the link sees the contact details they purchased.
export default async function Deliver({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const lead = await getLeadByDeliveryToken(token);
  if (!lead) notFound();

  return (
    <div className="mx-auto max-w-xl px-5 py-12">
      <div className="mb-6 flex items-center justify-between">
        <Logo size={24} />
        <span className="pill bg-ok/15 text-ok">Delivered</span>
      </div>

      <div className="card">
        <p className="eyebrow mb-1">Lead delivery</p>
        <h1 className="mb-1 font-display text-2xl font-bold">Your lead from {lead.brandName}</h1>
        <p className="mb-5 text-sm text-dim">
          Delivered to <b>{lead.buyer}</b>{lead.serviceInterest ? <> · interested in <b>{lead.serviceInterest}</b></> : null}.
          Contact this customer promptly — lead quality decays quickly.
        </p>

        <div className="rounded-[var(--r-lg)] border border-line bg-canvas/60 p-4">
          <dl className="grid grid-cols-[110px_1fr] gap-y-3 text-sm">
            <dt className="text-faint">Name</dt><dd className="font-semibold">{lead.contact.name || "—"}</dd>
            <dt className="text-faint">Phone</dt><dd className="mono text-data">{lead.contact.phone || "—"}</dd>
            <dt className="text-faint">Email</dt><dd className="mono">{lead.contact.email || "—"}</dd>
            <dt className="text-faint">Message</dt><dd>{lead.contact.message || "—"}</dd>
          </dl>
          <div className="mt-4 flex gap-2">
            {lead.contact.phone && <a className="btn" href={`tel:${lead.contact.phone.replace(/[^\d+]/g, "")}`}>Call now</a>}
            {lead.contact.email && <a className="btn-ghost" href={`mailto:${lead.contact.email}`}>Email</a>}
          </div>
        </div>

        <div className="mt-5">
          <p className="eyebrow mb-2">Consent & compliance</p>
          <div className="rounded-[var(--r)] border border-line p-3 text-xs text-dim">
            <p>{lead.consent?.text ?? "Consent captured at submission."}</p>
            <p className="mt-1 mono text-faint">
              captured {lead.consent?.timestamp ?? "—"} · ip {lead.consent?.ip ?? "—"}
              {lead.utm && Object.keys(lead.utm).length ? ` · source ${Object.values(lead.utm).join("/")}` : ""}
            </p>
          </div>
        </div>

        <p className="mt-5 text-[11px] text-faint">
          Sold {lead.soldAt ? new Date(lead.soldAt).toLocaleString() : ""}. This page is a private delivery receipt — treat the contact details as confidential and use them only in compliance with the consent above.
        </p>
      </div>
    </div>
  );
}
