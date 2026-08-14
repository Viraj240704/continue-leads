"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSampleReviewAction } from "@/app/actions/golive";
import type { GoLiveStatus } from "@/lib/golive";

function GateRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex gap-2">
      <span className={`mt-0.5 ${ok ? "text-ok" : "text-faint"}`}>{ok ? "✓" : "○"}</span>
      <div>
        <div className="text-sm font-medium">{label}</div>
        <div className="text-xs text-dim">{detail}</div>
      </div>
    </div>
  );
}

export function GoLiveChecklist({ brandId, status, canWrite }: { brandId: string; status: GoLiveStatus; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  return (
    <div className={`card border ${status.ready ? "border-ok/40" : "border-line"}`}>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Go-live gate</h2>
        {status.ready
          ? <span className="pill bg-ok/12 text-ok">Ready to go indexable</span>
          : <span className="pill bg-warn/15 text-warn">Gates pending</span>}
      </div>
      <p className="mb-3 text-xs text-dim">A site cannot flip from <span className="mono">noindex</span> to indexable until every gate passes. Legal & compliance boundary — no override.</p>

      <div className="space-y-2.5">
        <GateRow ok={status.automatedQa.ok} label="1 · Automated QA" detail={status.automatedQa.detail} />
        <GateRow ok={status.noindexRemoved.ok} label="2 · Noindex removed" detail={status.noindexRemoved.detail} />
        <GateRow ok={status.sampleReview.ok} label={`3 · Manual ${status.sampleSize}-page review`} detail={status.sampleReview.detail} />
        <GateRow ok={status.legalApproved.ok} label="4 · Legal sign-off" detail={status.legalApproved.detail} />
      </div>

      {status.sampleReview.reviewedAt && (
        <p className="mt-3 text-xs text-faint">
          Sample signed off by {status.sampleReview.reviewer} · {new Date(status.sampleReview.reviewedAt).toLocaleString("en-US", { timeZone: "UTC" })}
          {status.sampleReview.note ? ` — "${status.sampleReview.note}"` : ""}
        </p>
      )}

      {canWrite && !status.sampleReview.ok && (
        <div className="mt-3 border-t border-line pt-3">
          {open ? (
            <div className="space-y-2">
              <p className="text-xs text-dim">Confirm you reviewed {status.sampleSize} sample pages for content quality, tone, and obvious errors.</p>
              <input className="input h-8 py-0 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reviewer note (optional)" />
              <div className="flex gap-2">
                <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await recordSampleReviewAction(brandId, note.trim()); setOpen(false); router.refresh(); })}>
                  {pending ? "Recording…" : `Sign off ${status.sampleSize}-page review`}
                </button>
                <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn-ghost btn-sm w-full" onClick={() => setOpen(true)}>Start {status.sampleSize}-page sample review…</button>
          )}
        </div>
      )}
    </div>
  );
}
