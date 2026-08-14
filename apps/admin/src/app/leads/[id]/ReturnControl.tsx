"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { returnLeadAction } from "@/app/actions/leads";

export function ReturnControl({ leadId }: { leadId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return <button className="btn-ghost btn-sm w-full" onClick={() => setOpen(true)}>Mark returned…</button>;
  return (
    <div className="space-y-2">
      <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Return reason (e.g. wrong area)" />
      {err && <p className="text-xs text-bad">{err}</p>}
      <div className="flex gap-2">
        <button className="btn btn-sm flex-1" disabled={pending || !reason.trim()} onClick={() => start(async () => {
          setErr(null);
          const r = await returnLeadAction(leadId, reason.trim());
          if (!r.ok) { setErr(r.error ?? "Failed"); return; }
          setOpen(false); router.refresh();
        })}>{pending ? "…" : "Confirm return"}</button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </div>
  );
}
