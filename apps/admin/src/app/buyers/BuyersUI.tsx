"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBuyerAction, approveBuyerAction } from "@/app/actions/manage";

export function CreateBuyerForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", company: "", email: "", phone: "", verticals: "", geos: "", bidFloor: "", deliveryEndpoint: "", terms: false });
  const [err, setErr] = useState<string | null>(null);

  if (!open) return <button className="btn" onClick={() => setOpen(true)}>+ Onboard buyer</button>;

  const set = (k: string, v: any) => setF({ ...f, [k]: v });

  return (
    <div className="card w-full max-w-lg">
      <h3 className="mb-1 font-semibold">Onboard a buyer</h3>
      <p className="mb-3 text-xs text-dim">Buyers start as <b>pending</b> and can&apos;t be sold to until approved.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div><label className="label">Contact name</label><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><label className="label">Company</label><input className="input" value={f.company} onChange={(e) => set("company", e.target.value)} /></div>
        <div><label className="label">Email</label><input className="input mono" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><label className="label">Phone</label><input className="input mono" value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        <div><label className="label">Verticals (comma)</label><input className="input" value={f.verticals} onChange={(e) => set("verticals", e.target.value)} placeholder="painting, roofing" /></div>
        <div><label className="label">Geographies (comma)</label><input className="input" value={f.geos} onChange={(e) => set("geos", e.target.value)} placeholder="CO, TX" /></div>
        <div><label className="label">Bid floor ($/lead)</label><input className="input mono" value={f.bidFloor} onChange={(e) => set("bidFloor", e.target.value)} placeholder="25" /></div>
        <div><label className="label">Delivery endpoint</label><input className="input mono" value={f.deliveryEndpoint} onChange={(e) => set("deliveryEndpoint", e.target.value)} placeholder="https://…/leads" /></div>
        <label className="sm:col-span-2 flex items-center gap-2 text-xs text-dim"><input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} /> Buyer agreement / contract terms accepted</label>
      </div>
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn" disabled={pending}
          onClick={() => { if (!f.name.trim()) { setErr("Name is required"); return; } start(async () => {
            await createBuyerAction({
              name: f.name, company: f.company, email: f.email, phone: f.phone,
              verticals: f.verticals.split(",").map((s) => s.trim()).filter(Boolean),
              geos: f.geos.split(",").map((s) => s.trim()).filter(Boolean),
              bidFloor: Number(f.bidFloor) || 0, deliveryEndpoint: f.deliveryEndpoint, termsAccepted: f.terms,
            });
            setOpen(false); router.refresh();
          }); }}>
          {pending ? "Saving…" : "Save buyer (pending)"}
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}

export function ApprovalControl({ buyerId, status }: { buyerId: string; status: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (approve: boolean) => start(async () => { await approveBuyerAction(buyerId, approve); router.refresh(); });
  if (status === "approved") return <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(false)}>Revoke approval</button>;
  return (
    <div className="flex gap-2">
      <button className="btn btn-sm" disabled={pending} onClick={() => run(true)}>Approve buyer</button>
      {status !== "rejected" && <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(false)}>Reject</button>}
    </div>
  );
}

export function ApprovalPill({ status }: { status: string }) {
  const map: Record<string, string> = { approved: "bg-ok/15 text-ok", pending: "bg-warn/15 text-warn", rejected: "bg-bad/15 text-bad" };
  return <span className={`pill ${map[status] ?? map.pending}`}>{status}</span>;
}

export function CopyField({ url, label = "Copy" }: { url: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex gap-2">
      <input readOnly value={url} className="input mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>{copied ? "Copied" : label}</button>
      <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">Open</a>
    </div>
  );
}
