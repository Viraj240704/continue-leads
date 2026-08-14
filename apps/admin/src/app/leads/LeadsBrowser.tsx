"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { LIFECYCLE_LABELS, LIFECYCLE_ORDER, LIFECYCLE_TONE, type LeadPage, type Lifecycle } from "@/lib/lead-lifecycle-types";
import { validateLeadsAction, rejectLeadsAction, exportLeadsAction } from "@/app/actions/leads";

function Pill({ s }: { s: Lifecycle }) {
  return <span className={`pill ${LIFECYCLE_TONE[s]}`}>{LIFECYCLE_LABELS[s]}</span>;
}

export function LeadsBrowser({ data, filters, canWrite }: { data: LeadPage; filters: any; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [q, setQ] = useState(filters.q ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  const pages = Math.max(1, Math.ceil(data.total / data.pageSize));

  function setParam(patch: Record<string, string | undefined>) {
    const p = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) { v ? p.set(k, v) : p.delete(k); }
    if (!("page" in patch)) p.delete("page"); // reset page on filter change
    router.push(`/leads?${p.toString()}`);
  }

  const allChecked = data.rows.length > 0 && data.rows.every((r) => sel.has(r.id));
  const toggleAll = () => setSel(allChecked ? new Set() : new Set(data.rows.map((r) => r.id)));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const bulk = (fn: () => Promise<any>, label: string) => start(async () => {
    setMsg(null);
    const r = await fn();
    setMsg(`${label}: ${r.ok} done${r.errs?.length ? `, ${r.errs.length} skipped` : ""}.`);
    setSel(new Set());
    router.refresh();
  });

  async function exportCsv() {
    const csv = await exportLeadsAction(filters);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
  }

  return (
    <div>
      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <form
          onSubmit={(e) => { e.preventDefault(); setParam({ q: q || undefined }); }}
          className="relative"
        >
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search category / source / id…"
            className="input h-9 w-64" />
        </form>
        <select className="input h-9 !w-40" value={filters.status ?? ""} onChange={(e) => setParam({ status: e.target.value || undefined })}>
          <option value="">All statuses</option>
          {LIFECYCLE_ORDER.map((s) => <option key={s} value={s}>{LIFECYCLE_LABELS[s]}</option>)}
        </select>
        <select className="input h-9 !w-44" value={filters.brandId ?? ""} onChange={(e) => setParam({ brand: e.target.value || undefined })}>
          <option value="">All sites</option>
          {data.brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select className="input h-9 !w-44" value={filters.category ?? ""} onChange={(e) => setParam({ category: e.target.value || undefined })}>
          <option value="">All categories</option>
          {data.categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <input type="date" className="input h-9 !w-40" value={filters.from ?? ""} onChange={(e) => setParam({ from: e.target.value || undefined })} title="From date" />
        <input type="date" className="input h-9 !w-40" value={filters.to ?? ""} onChange={(e) => setParam({ to: e.target.value || undefined })} title="To date" />
        {(filters.q || filters.status || filters.brandId || filters.category || filters.from || filters.to) && (
          <button className="btn-ghost btn-sm" onClick={() => { setQ(""); router.push("/leads"); }}>Clear</button>
        )}
        <button className="btn-ghost btn-sm ml-auto" onClick={exportCsv}>Export CSV</button>
      </div>

      {/* Bulk bar */}
      {sel.size > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
          <span className="font-medium">{sel.size} selected</span>
          {canWrite && <>
            <button className="btn-sm btn" disabled={pending} onClick={() => bulk(() => validateLeadsAction([...sel]), "Validated")}>Validate</button>
            <button className="btn-sm btn-ghost" disabled={pending} onClick={() => bulk(() => rejectLeadsAction([...sel]), "Rejected")}>Reject</button>
          </>}
          <button className="btn-sm btn-ghost" onClick={() => setSel(new Set())}>Clear selection</button>
          {msg && <span className="text-xs text-dim">{msg}</span>}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-xs text-faint">
            <tr>
              <th className="w-8 px-3 py-2"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className="px-3 py-2 font-medium">Category</th>
              <th className="px-3 py-2 font-medium">Site</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">Price</th>
              <th className="px-3 py-2 font-medium">Captured</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data.rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-sm text-faint">No leads match these filters.</td></tr>
            )}
            {data.rows.map((l) => (
              <tr key={l.id} className={sel.has(l.id) ? "bg-primary/5" : ""}>
                <td className="px-3 py-2"><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                <td className="px-3 py-2 font-medium">{l.category}</td>
                <td className="px-3 py-2 text-dim">{l.brandName}</td>
                <td className="mono px-3 py-2 text-xs text-faint">{l.source}</td>
                <td className="px-3 py-2"><Pill s={l.lifecycle} /></td>
                <td className="px-3 py-2 text-right tabular-nums">{l.priceUsd ? `$${l.priceUsd.toFixed(0)}` : "—"}</td>
                <td className="px-3 py-2 text-xs text-faint">{new Date(l.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric" })}</td>
                <td className="px-3 py-2 text-right"><Link href={`/leads/${l.id}`} className="text-xs text-primary hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-3 flex items-center justify-between text-sm text-dim">
        <span>{data.total} lead{data.total === 1 ? "" : "s"}</span>
        <div className="flex items-center gap-2">
          <button className="btn-ghost btn-sm" disabled={data.page <= 1} onClick={() => setParam({ page: String(data.page - 1) })}>← Prev</button>
          <span className="text-xs">Page {data.page} / {pages}</span>
          <button className="btn-ghost btn-sm" disabled={data.page >= pages} onClick={() => setParam({ page: String(data.page + 1) })}>Next →</button>
        </div>
      </div>
    </div>
  );
}
