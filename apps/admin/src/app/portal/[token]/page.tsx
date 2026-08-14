import { notFound } from "next/navigation";
import { getBuyerPortal } from "@/lib/buyers";
import { Logo } from "@/components/Logo";

export const dynamic = "force-dynamic";

// Public buyer portal — a buyer's account view of every lead they've purchased.
// Token-gated (no login); the link is the credential.
export default async function Portal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await getBuyerPortal(token);
  if (!data) notFound();
  const { buyer, leads, spend } = data;

  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <div className="mb-6 flex items-center justify-between">
        <Logo size={24} />
        <span className="pill bg-data/15 text-data">Buyer portal</span>
      </div>

      <div className="mb-6">
        <p className="eyebrow mb-1">Your leads</p>
        <h1 className="font-display text-2xl font-bold">{buyer.company || buyer.name}</h1>
        <p className="text-sm text-dim">{leads.length} lead(s) purchased · total ${spend.toFixed(2)}. Contact each customer promptly.</p>
      </div>

      {leads.length === 0 ? (
        <div className="card text-dim">No leads yet. New purchases will appear here.</div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <div key={l.id} className="card">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{l.contact.name || "—"}</div>
                  <div className="text-xs text-faint">{l.brandName}{l.serviceInterest ? ` · ${l.serviceInterest}` : ""} · {l.soldAt ? new Date(l.soldAt).toLocaleDateString() : ""}</div>
                </div>
                <span className="pill bg-ok/15 text-ok">quality {l.qualityScore}</span>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <span className="mono text-data">{l.contact.phone || "—"}</span>
                <span className="mono text-dim">{l.contact.email || "—"}</span>
              </div>
              {l.contact.message && <p className="mt-2 text-sm text-dim">“{l.contact.message}”</p>}
              <div className="mt-3 flex gap-2">
                {l.contact.phone && <a className="btn btn-sm" href={`tel:${l.contact.phone.replace(/[^\d+]/g, "")}`}>Call</a>}
                {l.contact.email && <a className="btn-ghost btn-sm" href={`mailto:${l.contact.email}`}>Email</a>}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="mt-6 text-[11px] text-faint">Private portal. Treat these contact details as confidential and use them only in line with each customer&apos;s consent.</p>
    </div>
  );
}
