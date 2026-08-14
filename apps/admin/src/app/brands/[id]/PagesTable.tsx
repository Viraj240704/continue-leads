"use client";
import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { StatePill, QaPill, IndexPill } from "@/components/Pills";
import { decideAction } from "@/app/actions/site";
import {
  setPageEnabledAction, updatePageBriefAction, regeneratePageAction, launchPageNowAction,
  bulkDecideAction, bulkSetEnabledAction, bulkRegenerateAction,
} from "@/app/actions/manage";

interface PageRow {
  id: string; path: string; page_type: string; deployment_state: string; indexing_state: string;
  current_version_id: string | null; qa_status: string | null; enabled: boolean; brief: string;
}

export function PagesTable({ brandId, brandSlug, pages }: { brandId: string; brandSlug: string; pages: PageRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [openBrief, setOpenBrief] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<string | null>(null);

  const run = (id: string, fn: () => Promise<any>) => start(async () => { setBusyId(id); setMsg(null); try { const r = await fn(); if (r && r.ok === false) setMsg(r.reason ?? "Action failed"); router.refresh(); } finally { setBusyId(null); } });
  const runBulk = (fn: () => Promise<any>, label: (r: any) => string) => start(async () => { setMsg(null); const r = await fn(); setMsg(label(r)); setSel(new Set()); router.refresh(); });

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = sel.size > 0 && sel.size === pages.length;
  const selArr = [...sel];
  const enabledCount = pages.filter((p) => p.enabled).length;
  const actionBtn = "inline-flex h-7 items-center justify-center rounded-md border px-2 text-xs font-medium transition";
  const ghostAction = `${actionBtn} border-line bg-white text-dim shadow-[0_1px_2px_rgba(16,24,40,0.04)] hover:bg-raised hover:text-ink`;

  return (
    <div>
      {sel.size > 0 ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-[var(--r)] border border-amber/30 bg-amber/5 px-3 py-2">
          <span className="text-xs font-semibold text-amber">{sel.size} selected</span>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => runBulk(() => bulkDecideAction(brandId, selArr, "approved"), (r) => `Approved ${r.count}`)}>Approve</button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => runBulk(() => bulkSetEnabledAction(brandId, selArr, true), (r) => `Enabled ${r.count}`)}>Enable</button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => runBulk(() => bulkSetEnabledAction(brandId, selArr, false), (r) => `Disabled ${r.count}`)}>Disable</button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => runBulk(() => bulkRegenerateAction(brandId, selArr), (r) => `Regenerated ${r.generated}`)}>Regenerate</button>
          <button className="btn-ghost btn-sm" disabled={pending} onClick={() => runBulk(() => bulkDecideAction(brandId, selArr, "rejected"), (r) => `Rejected ${r.count}`)}>Reject</button>
          <button className="ml-auto text-xs text-faint hover:text-ink" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      ) : (
        <div className="mb-2 flex items-center justify-between">
          <p className="mono text-xs text-faint">{enabledCount} of {pages.length} pages enabled</p>
          {msg && <p className="text-xs text-data">{msg}</p>}
        </div>
      )}
      {sel.size > 0 && msg && <p className="mb-2 text-xs text-data">{msg}</p>}

      <div className="data-table overflow-hidden rounded-[var(--r-lg)] border border-line">
        <table className="w-full border-collapse">
          <thead className="bg-raised/40">
            <tr>
              <th className="th w-8"><input type="checkbox" checked={allSelected} onChange={(e) => setSel(e.target.checked ? new Set(pages.map((p) => p.id)) : new Set())} aria-label="Select all" /></th>
              <th className="th">Page</th><th className="th">Status</th><th className="th">QA</th>
              <th className="th w-[220px] text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pages.map((p) => {
              const gen = !!p.current_version_id;
              const published = p.deployment_state === "published";
              const canLaunch = p.enabled && gen && ["approved", "scheduled"].includes(p.deployment_state);
              const viewHref = published ? `/live/${brandSlug}${p.path === "/" ? "" : p.path}` : gen ? `/preview/${p.current_version_id}` : null;
              const busy = busyId === p.id;
              return (
                <Fragment key={p.id}>
                  <tr className={`border-t border-line/60 ${p.enabled ? "" : "opacity-45"} ${sel.has(p.id) ? "bg-amber/5" : ""}`}>
                    <td className="td"><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.path}`} /></td>
                    <td className="td">
                      <div className="mono text-xs text-ink">{p.path}</div>
                      <div className="mono text-[10px] uppercase tracking-wider text-faint">{p.page_type}{!p.enabled && " · disabled"}</div>
                    </td>
                    <td className="td"><div className="flex flex-col items-start gap-1"><StatePill state={p.deployment_state} /><IndexPill state={p.indexing_state} /></div></td>
                    <td className="td"><QaPill status={p.qa_status} /></td>
                    <td className="td w-[220px] align-middle">
                      <div className="grid grid-cols-[repeat(3,max-content)] justify-end gap-1.5">
                        {viewHref
                          ? <a href={viewHref} target="_blank" rel="noreferrer" className={ghostAction}>{published ? "Live ↗" : "Preview ↗"}</a>
                          : <span className={`${ghostAction} cursor-not-allowed opacity-40`} title="Generate this page first">Preview</span>}

                        {p.deployment_state === "generated" && p.qa_status !== "fail" && (
                          <button className={`${actionBtn} border-ok/40 bg-ok/10 text-ok`} disabled={busy}
                            onClick={() => run(p.id, () => decideAction(brandId, p.id, "approved"))}>Approve</button>
                        )}
                        {canLaunch && (
                          <button className={`${actionBtn} border-primary bg-primary text-white`} disabled={busy}
                            onClick={() => run(p.id, () => launchPageNowAction(brandId, p.id))} title="Publish this page immediately">Launch</button>
                        )}
                        {["generated", "approved"].includes(p.deployment_state) && (
                          <button className={`${actionBtn} border-bad/40 bg-bad/10 text-bad`} disabled={busy}
                            onClick={() => run(p.id, () => decideAction(brandId, p.id, "rejected"))}>Reject</button>
                        )}
                        {gen && (
                          <button className={`${ghostAction} w-8 px-0`} disabled={busy} title="Regenerate this page"
                            onClick={() => run(p.id, () => regeneratePageAction(brandId, p.id))}>↻</button>
                        )}
                        <button className={`${ghostAction} ${openBrief === p.id ? "text-amber" : ""}`}
                          onClick={() => setOpenBrief(openBrief === p.id ? null : p.id)} title="Per-page brief">Brief{p.brief ? " •" : ""}</button>
                        <label className="inline-flex h-7 cursor-pointer items-center justify-center rounded-md border border-line bg-white px-2 text-[11px] text-faint" title="Enable/disable this page">
                          <input type="checkbox" checked={p.enabled} disabled={busy}
                            onChange={(e) => run(p.id, () => setPageEnabledAction(brandId, p.id, e.target.checked))} />
                        </label>
                      </div>
                    </td>
                  </tr>
                  {openBrief === p.id && (
                    <tr className="border-t border-line/40 bg-canvas/40">
                      <td className="td"></td>
                      <td className="td" colSpan={4}><PageBrief brandId={brandId} pageId={p.id} initial={p.brief} onSaved={() => { setOpenBrief(null); router.refresh(); }} /></td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PageBrief({ brandId, pageId, initial, onSaved }: { brandId: string; pageId: string; initial: string; onSaved: () => void }) {
  const [val, setVal] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2 py-1">
      <p className="text-xs text-dim">Per-page brief — emphasis just for this page (added on next generate/regenerate).</p>
      <textarea className="input min-h-[64px]" value={val} onChange={(e) => setVal(e.target.value)}
        placeholder="e.g. Highlight our 10-year warranty and same-week booking for this service." />
      <button className="btn btn-sm" disabled={pending}
        onClick={() => start(async () => { await updatePageBriefAction(brandId, pageId, val); onSaved(); })}>Save brief</button>
    </div>
  );
}
