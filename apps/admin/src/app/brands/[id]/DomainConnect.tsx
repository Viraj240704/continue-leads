"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyDomainAction, updateDomainAction } from "@/app/actions/domain";
import type { DomainStatus } from "@/lib/domain";

function Copy({ text }: { text: string }) {
  return <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(text)}>Copy</button>;
}

export function DomainConnect({ brandId, status, canWrite }: { brandId: string; status: DomainStatus; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const [editing, setEditing] = useState(false);
  const [domain, setDomain] = useState(status.domain);
  const host = status.domain.replace(/^https?:\/\//, "");
  const recordName = host.split(".").length > 2 ? host.split(".")[0]! : "@";

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Domain</h2>
        {status.verified
          ? <span className="pill bg-ok/12 text-ok">Connected</span>
          : <span className="pill bg-warn/15 text-warn">Not connected</span>}
      </div>

      {editing ? (
        <div className="mb-3 flex gap-2">
          <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)} />
          <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { await updateDomainAction(brandId, domain); setEditing(false); router.refresh(); })}>Save</button>
          <button className="btn-ghost btn-sm" onClick={() => setEditing(false)}>Cancel</button>
        </div>
      ) : (
        <p className="mb-3 text-sm">
          <span className="mono">{host}</span>
          {canWrite && <button className="ml-2 text-xs text-primary hover:underline" onClick={() => setEditing(true)}>Change</button>}
        </p>
      )}

      <p className="mb-2 text-xs text-dim">{status.detail}</p>

      {!status.verified && (
        <div className="rounded-md border border-line bg-canvas p-3 text-xs">
          <p className="mb-2 font-medium text-dim">Add this DNS record at your registrar:</p>
          <div className="grid grid-cols-[70px_1fr] gap-y-1">
            <span className="text-faint">Type</span><span className="mono">{status.recordType}</span>
            <span className="text-faint">Name</span><span className="mono">{recordName}</span>
            <span className="text-faint">Value</span>
            <span className="mono flex items-center gap-1 break-all">{status.target} <Copy text={status.target} /></span>
          </div>
        </div>
      )}

      {canWrite && (
        <div className="mt-3 flex items-center gap-2">
          <button className="btn btn-sm" disabled={pending} onClick={() => start(async () => { setResult(await verifyDomainAction(brandId)); router.refresh(); })}>
            {pending ? "Checking DNS…" : status.verified ? "Re-verify" : "Verify"}
          </button>
          {result && <span className={`text-xs ${result.ok ? "text-ok" : "text-warn"}`}>{result.detail}</span>}
        </div>
      )}
      {status.verifiedAt && <p className="mt-2 text-xs text-faint">Verified {new Date(status.verifiedAt).toLocaleString("en-US", { timeZone: "UTC" })}</p>}
    </div>
  );
}
