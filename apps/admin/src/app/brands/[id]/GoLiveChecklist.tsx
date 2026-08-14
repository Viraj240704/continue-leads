"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordSampleReviewAction } from "@/app/actions/golive";
import type { GoLiveStatus } from "@/lib/golive";
import { CheckCircleIcon } from "@/components/Icons";

function GateRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <div className="flex gap-3 rounded-[var(--r)] bg-canvas/60 p-3">
      <span className={`mt-0.5 shrink-0 ${ok ? "text-ok" : "text-faint"}`}><CheckCircleIcon size={18} /></span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{label}</div>
        <div className="mt-1 text-xs leading-5 text-dim">{detail}</div>
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

      <div className="grid gap-3 sm:grid-cols-2">
        <GateRow ok={status.automatedQa.ok} label="Automated QA" detail={status.automatedQa.detail} />
        <GateRow ok={status.noindexRemoved.ok} label="Noindex removed" detail={status.noindexRemoved.detail} />
        <GateRow ok={status.sampleReview.ok} label={`Manual ${status.sampleSize}-page review`} detail={status.sampleReview.detail} />
        <GateRow ok={status.legalApproved.ok} label="Legal sign-off" detail={status.legalApproved.detail} />
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
              <label className="mb-1.5 block text-xs font-semibold text-dim" htmlFor="reviewer-note">Reviewer note (optional)</label>
              <div className="flex h-9 gap-2">
                <input id="reviewer-note" className="input h-9 min-w-0 flex-1 py-0 text-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note about the review" />
                <button className="btn btn-sm h-9 shrink-0" disabled={pending} onClick={() => start(async () => { await recordSampleReviewAction(brandId, note.trim()); setOpen(false); router.refresh(); })}>
                  {pending ? "Recording…" : `Sign off ${status.sampleSize}-page review`}
                </button>
                <button className="btn-ghost btn-sm h-9 shrink-0" onClick={() => setOpen(false)}>Cancel</button>
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
