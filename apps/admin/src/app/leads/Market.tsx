"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sellLeadAction, revalidateLeadAction } from "@/app/actions/manage";

export function ValidationPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    valid: "bg-ok/15 text-ok", invalid: "bg-bad/15 text-bad",
    review: "bg-warn/15 text-warn", pending: "bg-faint/15 text-faint",
  };
  return <span className={`pill ${map[status] ?? map.pending}`}>{status}</span>;
}
export function SalePill({ status }: { status: string }) {
  const map: Record<string, string> = {
    for_sale: "bg-data/15 text-data", sold: "bg-amber/15 text-amber",
    rejected: "bg-bad/15 text-bad", new: "bg-faint/15 text-faint",
  };
  return <span className={`pill ${map[status] ?? map.new}`}>{status.replace("_", " ")}</span>;
}
export function QualityBar({ score }: { score: number }) {
  const color = score >= 70 ? "var(--ok)" : score >= 40 ? "var(--warn)" : "var(--bad)";
  return (
    <div className="flex items-center gap-2">
      <div className="meter w-16"><span style={{ width: `${score}%`, background: color }} /></div>
      <span className="mono text-xs text-dim">{score}</span>
    </div>
  );
}

export function DeliveryLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input readOnly value={url} className="input mono text-xs" onFocus={(e) => e.currentTarget.select()} />
        <button className="btn-ghost btn-sm" onClick={() => { navigator.clipboard?.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }}>
          {copied ? "Copied" : "Copy"}
        </button>
        <a className="btn btn-sm" href={url} target="_blank" rel="noreferrer">Open</a>
      </div>
      <p className="text-[11px] text-faint">Share this private link with the buyer. Anyone with the link can view the full contact details.</p>
    </div>
  );
}

export function LeadRowActions({ lead, buyers = [] }: { lead: { id: string; sale_status: string; validation_status: string }; buyers?: { id: string; name: string }[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selling, setSelling] = useState(false);
  const [choice, setChoice] = useState(buyers[0]?.id ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  if (lead.sale_status === "sold") {
    return <Link href={`/leads/${lead.id}`} className="text-xs text-amber hover:underline">delivery ↗</Link>;
  }

  const doSell = () => start(async () => {
    const r = await sellLeadAction(lead.id, choice);
    if (!r.ok) setMsg(r.reason ?? "failed"); else { setSelling(false); router.refresh(); }
  });

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link href={`/leads/${lead.id}`} className="text-xs text-accent hover:underline">view</Link>
      <button className="text-xs text-dim hover:text-ink" disabled={pending}
        onClick={() => start(async () => { await revalidateLeadAction(lead.id); router.refresh(); })}>revalidate</button>
      {lead.validation_status !== "invalid" && (
        selling ? (
          buyers.length === 0 ? (
            <span className="text-xs text-warn">No approved buyer — <Link href="/buyers" className="underline">onboard one</Link></span>
          ) : (
            <span className="flex items-center gap-1">
              <select value={choice} onChange={(e) => setChoice(e.target.value)} className="rounded border border-line bg-canvas px-1 py-0.5 text-xs">
                {buyers.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
              <button className="text-xs text-ok" disabled={pending || !choice} onClick={doSell}>confirm</button>
              <button className="text-xs text-faint" onClick={() => setSelling(false)}>×</button>
            </span>
          )
        ) : (
          <button className="text-xs text-ok hover:underline" onClick={() => setSelling(true)}>sell</button>
        )
      )}
      {msg && <span className="text-xs text-bad">{msg}</span>}
    </div>
  );
}
