"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { legalApproveBrandAction } from "@/app/actions/manage";

// Deterministic date format (fixed locale + UTC) so server and client HTML match.
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" });
}

interface Check { key: string; label: string; ok: boolean; detail: string }
interface Props {
  brandId: string;
  compliance: { checks: Check[]; autoOk: boolean; legalApproved: boolean; goLiveReady: boolean; legalApprovedAt: string | null };
}

export function Compliance({ brandId, compliance }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [notes, setNotes] = useState("");
  const run = (approve: boolean) => start(async () => { await legalApproveBrandAction(brandId, approve, notes || undefined); router.refresh(); });

  return (
    <div className={`card ${compliance.goLiveReady ? "border-ok/40" : "border-warn/40"}`}>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="section-title">Compliance</span>
          {compliance.goLiveReady
            ? <span className="pill bg-ok/15 text-ok">cleared for go-live</span>
            : <span className="pill bg-warn/15 text-warn">not cleared — publishing blocked</span>}
        </div>
      </div>

      <ul className="grid gap-2 sm:grid-cols-2">
        {compliance.checks.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-sm">
            <span className={c.ok ? "text-ok" : "text-bad"}>{c.ok ? "✓" : "✗"}</span>
            <span><span className="font-medium">{c.label}</span><br /><span className="text-xs text-dim">{c.detail}</span></span>
          </li>
        ))}
      </ul>

      <div className="mt-4 border-t border-line pt-3">
        {compliance.legalApproved ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-dim">Attorney sign-off recorded{compliance.legalApprovedAt ? ` ${fmtDate(compliance.legalApprovedAt)}` : ""}.</p>
            <button className="btn-ghost btn-sm" disabled={pending} onClick={() => run(false)}>Revoke sign-off</button>
          </div>
        ) : (
          <div>
            <div className="flex h-9 gap-2">
              <input className="input h-9 min-w-0 flex-1 py-0 text-xs" placeholder="Reviewer notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button className="btn btn-sm h-9 shrink-0" disabled={pending || !compliance.autoOk} onClick={() => run(true)}>Approve for go-live (legal sign-off)</button>
            </div>
            {!compliance.autoOk && <p className="mt-2 text-xs text-warn">Resolve the automated checks above first.</p>}
          </div>
        )}
      </div>
    </div>
  );
}
