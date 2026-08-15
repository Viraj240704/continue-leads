"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBuyerAction, approveBuyerAction } from "@/app/actions/manage";
import { BuildingIcon, DollarIcon, GlobeIcon, MailIcon, MapPinIcon, UserIcon } from "@/components/Icons";

export function BuyersPageBody({ buyers }: { buyers: any[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-l font-bold tracking-tight">Buyers</h1>
        </div>
        {!open && <button className="btn shrink-0" onClick={() => setOpen(true)}>+ Onboard buyer</button>}
      </div>

      <div className="space-y-4">
        {buyers.length === 0 ? (
          <div className="card text-dim">No buyers yet. Add one, or create one on the fly when selling a lead.</div>
        ) : null}

        {open ? <CreateBuyerForm open={open} onOpenChange={setOpen} hideTrigger /> : null}

        {buyers.length > 0 ? (
          <div className="data-table overflow-x-auto rounded-[var(--r-lg)] border border-line">
            <table className="w-full border-collapse">
              <thead className="bg-raised/40"><tr>
                <th className="th">Buyer</th><th className="th">Status</th><th className="th">Company</th>
                <th className="th">Leads</th><th className="th">Sold</th><th className="th">Spend</th><th className="th"></th>
              </tr></thead>
              <tbody>
                {buyers.map((b: any) => (
                  <tr key={b.id} className="border-t border-line/60">
                    <td className="td font-semibold">{b.name}</td>
                    <td className="td"><ApprovalPill status={b.approval_status} /></td>
                    <td className="td text-dim">{b.company || "—"}</td>
                    <td className="td">{b.lead_count}</td>
                    <td className="td">{b.sold_count}</td>
                    <td className="td font-semibold text-amber">${Number(b.spend).toFixed(2)}</td>
                    <td className="td text-right"><Link href={`/buyers/${b.id}`} className="text-xs text-accent hover:underline">manage ↗</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </>
  );
}

export function CreateBuyerForm({
  open,
  onOpenChange,
  hideTrigger = false,
}: {
  open?: boolean;
  onOpenChange?: (next: boolean) => void;
  hideTrigger?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [internalOpen, setInternalOpen] = useState(false);
  const initialForm = {
    name: "",
    company: "",
    email: "",
    phone: "",
    verticals: "",
    geos: "",
    bidFloor: "",
    deliveryEndpoint: "",
    terms: false,
  };
  const [f, setF] = useState(initialForm);
  const [err, setErr] = useState<string | null>(null);
  const isControlled = typeof open === "boolean" && typeof onOpenChange === "function";
  const isOpen = isControlled ? open : internalOpen;
  const setOpenState = (next: boolean) => {
    if (isControlled) onOpenChange(next);
    else setInternalOpen(next);
  };

  if (!isOpen) return hideTrigger ? null : <button className="btn" onClick={() => setOpenState(true)}>+ Onboard buyer</button>;

  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const clear = () => {
    setF(initialForm);
    setErr(null);
  };

  return (
    <div className="card w-full p-4 sm:p-5">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-ink">Onboard a buyer</h3>
          <p className="mt-1 text-xs text-dim">Buyers start as <b>pending</b> and can&apos;t be sold to until approved.</p>
        </div>
        <button type="button" className="btn-ghost btn-sm shrink-0" onClick={clear}>Clear form</button>
      </div>

      <div className="space-y-5">
        <section>
          <p className="section-title mb-3">Contact information</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldWithIcon label="Contact name" icon={UserIcon}>
              <input className="input pl-12" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Enter contact name" />
            </FieldWithIcon>
            <FieldWithIcon label="Company" icon={BuildingIcon}>
              <input className="input pl-12" value={f.company} onChange={(e) => set("company", e.target.value)} placeholder="Enter company name" />
            </FieldWithIcon>
            <FieldWithIcon label="Email" icon={MailIcon}>
              <input className="input mono pl-12" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="Enter email address" />
            </FieldWithIcon>
            <FieldWithIcon label="Phone" icon={PhoneFieldIcon}>
              <input className="input mono pl-12" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="Enter phone number" />
            </FieldWithIcon>
          </div>
        </section>

        <section>
          <p className="section-title mb-3">Business details</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldWithIcon label="Verticals (comma)" icon={GlobeIcon}>
              <input className="input pl-12" value={f.verticals} onChange={(e) => set("verticals", e.target.value)} placeholder="Example: painting, roofing" />
            </FieldWithIcon>
            <FieldWithIcon label="Geographies (comma)" icon={MapPinIcon}>
              <input className="input pl-12" value={f.geos} onChange={(e) => set("geos", e.target.value)} placeholder="Example: CO, TX" />
            </FieldWithIcon>
            <FieldWithIcon label="Bid floor ($/lead)" icon={DollarIcon}>
              <input className="input mono pl-12" value={f.bidFloor} onChange={(e) => set("bidFloor", e.target.value)} placeholder="Enter amount" />
            </FieldWithIcon>
            <FieldWithIcon label="Delivery endpoint" icon={LinkFieldIcon}>
              <input className="input mono pl-12" value={f.deliveryEndpoint} onChange={(e) => set("deliveryEndpoint", e.target.value)} placeholder="https://.../leads" />
            </FieldWithIcon>
          </div>
        </section>

        <section className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="section-title mb-3">Agreement</p>
            <label className="flex items-center gap-2 text-xs text-dim">
              <input type="checkbox" checked={f.terms} onChange={(e) => set("terms", e.target.checked)} />
              Buyer agreement / contract terms accepted
            </label>
          </div>

          <div className="flex gap-2 lg:justify-end">
            <button
              className="btn"
              disabled={pending}
              onClick={() => {
                if (!f.name.trim()) {
                  setErr("Name is required");
                  return;
                }
                start(async () => {
                  await createBuyerAction({
                    name: f.name,
                    company: f.company,
                    email: f.email,
                    phone: f.phone,
                    verticals: f.verticals.split(",").map((s) => s.trim()).filter(Boolean),
                    geos: f.geos.split(",").map((s) => s.trim()).filter(Boolean),
                    bidFloor: Number(f.bidFloor) || 0,
                    deliveryEndpoint: f.deliveryEndpoint,
                    termsAccepted: f.terms,
                  });
                  setOpenState(false);
                  router.refresh();
                });
              }}
            >
              {pending ? "Saving..." : "Save buyer (pending)"}
            </button>
            <button className="btn-ghost" onClick={() => setOpenState(false)}>Cancel</button>
          </div>
        </section>
      </div>

      {err && <p className="mt-2 text-xs text-bad">{err}</p>}
    </div>
  );
}

function FieldWithIcon({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: (props: { size?: number; className?: string }) => React.JSX.Element;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="relative">
        <Icon size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
        {children}
      </div>
    </div>
  );
}

function PhoneFieldIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72l.32 2.57a2 2 0 0 1-.57 1.73L7.1 9.79a16 16 0 0 0 7.11 7.11l1.77-1.76a2 2 0 0 1 1.73-.57l2.57.32A2 2 0 0 1 22 16.92Z" />
    </svg>
  );
}

function LinkFieldIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07L11.75 5" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07L12.25 19" />
    </svg>
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
