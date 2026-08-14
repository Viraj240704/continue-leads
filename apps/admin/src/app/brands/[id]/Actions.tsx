"use client";
import { useState, useTransition } from "react";
import {
  generateAllAction, approveAllAction, scheduleAction, publishTickAction,
  rollbackAction, pauseAction, resumeAction, decideAction,
} from "@/app/actions/site";

function useRun() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const run = (fn: () => Promise<any>, fmt: (r: any) => string) =>
    start(async () => {
      setMsg(null);
      try { setMsg(fmt(await fn())); }
      catch (e: any) { if (e?.digest?.startsWith?.("NEXT_REDIRECT")) throw e; setMsg("Error: " + (e?.message ?? "failed")); }
    });
  return { pending, msg, run };
}

export function PipelineBar({ brandId, status }: { brandId: string; status: string }) {
  const { pending, msg, run } = useRun();
  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button className="pipeline-step" disabled={pending}
          onClick={() => run(() => generateAllAction(brandId), (r) => `Generated ${r.generated} pages · QA ${r.qaPass} pass / ${r.qaWarn} warn / ${r.qaFail} fail · $${r.costUsd}`)}>
          1 · Generate all
        </button>
        <button className="pipeline-step" disabled={pending}
          onClick={() => run(() => approveAllAction(brandId), (r) => `Approved ${r.approved} eligible pages`)}>
          2 · Approve all eligible
        </button>
        <button className="pipeline-step" disabled={pending}
          onClick={() => run(() => scheduleAction(brandId), (r) => `Built ${r.length} waves`)}>
          3 · Build schedule
        </button>
        <button className="pipeline-step" disabled={pending}
          onClick={() => run(() => publishTickAction(brandId), (r) => r.blocked ? `Blocked — ${r.blocked}` : `Published ${r.published}, skipped ${r.skipped}${r.manifestVersion ? ` · manifest v${r.manifestVersion}` : ""}`)}>
          4 · Run publisher tick
        </button>
        <div className="ml-auto flex gap-2">
          <button className="btn-danger" disabled={pending}
            onClick={() => run(() => rollbackAction(brandId), (r) => (r.ok ? `Rolled back to manifest v${r.restoredVersion}` : `Rollback: ${r.reason}`))}>
            Rollback
          </button>
          {status === "paused" ? (
            <button className="btn-ghost" disabled={pending} onClick={() => run(() => resumeAction(brandId), () => "Resumed")}>Resume</button>
          ) : (
            <button className="btn-ghost" disabled={pending} onClick={() => run(() => pauseAction(brandId), () => "Paused (emergency stop)")}>Pause</button>
          )}
        </div>
      </div>
      {pending && <p className="text-xs text-faint">Working…</p>}
      {msg && <p className="text-sm text-accent">{msg}</p>}
    </div>
  );
}

export function RowActions({ brandId, pageId, state }: { brandId: string; pageId: string; state: string }) {
  const { pending, run } = useRun();
  const canApprove = state === "generated";
  const canReject = ["generated", "approved"].includes(state);
  return (
    <div className="flex gap-1">
      <button className="rounded border border-ok/40 px-2 py-0.5 text-xs text-ok disabled:opacity-30"
        disabled={pending || !canApprove}
        onClick={() => run(() => decideAction(brandId, pageId, "approved"), () => "")}>Approve</button>
      <button className="rounded border border-bad/40 px-2 py-0.5 text-xs text-bad disabled:opacity-30"
        disabled={pending || !canReject}
        onClick={() => run(() => decideAction(brandId, pageId, "rejected"), () => "")}>Reject</button>
    </div>
  );
}
