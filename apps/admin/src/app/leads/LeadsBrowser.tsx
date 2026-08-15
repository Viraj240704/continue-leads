"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { LIFECYCLE_LABELS, LIFECYCLE_ORDER, type LeadPage, type Lifecycle } from "@/lib/lead-lifecycle-types";
import { validateLeadsAction, rejectLeadsAction, exportLeadsAction } from "@/app/actions/leads";
import { CalendarIcon, SearchIcon } from "@/components/Icons";

function Pill({ s }: { s: Lifecycle }) {
  const tone: { chip: string; dot: string } = {
    new: { chip: "bg-primary/10 text-primary", dot: "bg-primary" },
    validated: { chip: "bg-info/10 text-info", dot: "bg-info" },
    sold: { chip: "bg-ok/10 text-ok", dot: "bg-ok" },
    rejected: { chip: "bg-bad/10 text-bad", dot: "bg-bad" },
    returned: { chip: "bg-faint/12 text-faint", dot: "bg-faint" },
  }[s];
  return <span className={`inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium ${tone.chip}`}><span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />{LIFECYCLE_LABELS[s]}</span>;
}

function DateFilter({ value, placeholder, onChange }: { value?: string; placeholder: string; onChange: (value: string | undefined) => void }) {
  const display = value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : placeholder;
  return (
    <label className="group relative block h-11 w-full cursor-pointer rounded-[10px] border border-[#D9E1EC] bg-white transition hover:border-[#b9c5d6] has-[:focus]:border-primary has-[:focus]:shadow-[var(--ring)]">
      <CalendarIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
      <span className={`pointer-events-none absolute left-9 right-9 top-1/2 -translate-y-1/2 truncate text-[14px] font-medium ${value ? "text-[#1E293B]" : "text-faint"}`}>{display}</span>
      <input type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || undefined)} placeholder={placeholder} aria-label={placeholder}
        onClick={(e) => e.currentTarget.showPicker?.()}
        className="peer absolute inset-0 h-full w-full cursor-pointer rounded-[10px] border-0 bg-transparent p-0 text-transparent opacity-0 outline-none" />
    </label>
  );
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: Array<{ value: string; label: string }>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0] ?? { value: "", label: "" };

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((current) => !current)}
        className={`flex h-11 w-full items-center justify-between rounded-[10px] border bg-white px-3 text-left text-[14px] font-medium text-[#1E293B] transition duration-200 focus:outline-none ${open ? "border-[#5B4BFF] ring-2 ring-[#5B4BFF]/20" : "border-[#D9E1EC] hover:border-[#b9c5d6]"}`}>
        <span className="min-w-0 truncate whitespace-nowrap">{selected.label}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#475569] transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={`absolute left-0 top-[calc(100%+8px)] z-30 max-h-[220px] min-w-full w-max origin-top overflow-y-auto scroll-smooth rounded-[12px] bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,.12)] transition duration-200 ${open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`} role="listbox" aria-label={label}>
        <div className="grid gap-0.5">
          {options.map((option) => <button key={option.value} type="button" role="option" aria-selected={option.value === value} onClick={() => { onChange(option.value); setOpen(false); }} className={`flex h-[34px] w-full items-center rounded-[8px] px-3 text-left text-[14px] transition-colors ${option.value === value ? "bg-[#EEF2FF] font-semibold text-[#5B4BFF]" : "text-[#1E293B] hover:bg-[#E6E9FF]"}`}><span className="whitespace-nowrap">{option.label}</span></button>)}
        </div>
      </div>
    </div>
  );
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
      <section className="card mb-5 rounded-[12px] p-3" aria-label="Lead filters">
        <div className="grid min-w-0 items-center gap-2.5 xl:grid-cols-[250px_minmax(130px,170px)_minmax(140px,180px)_minmax(140px,180px)_minmax(110px,140px)_minmax(110px,140px)_auto_auto] xl:whitespace-nowrap">
        <form
          onSubmit={(e) => { e.preventDefault(); setParam({ q: q || undefined }); }}
          className="relative min-w-0"
        >
          <label className="relative block">
            <span className="sr-only">Search category, source or id</span>
            <SearchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search category / source / id..."
              className="input h-11 w-[250px] max-w-full rounded-[10px] border-[#D9E1EC] px-3 pl-9 text-[14px] font-medium" />
          </label>
        </form>
        <FilterSelect label="Status" value={filters.status ?? ""} options={[{ value: "", label: "All statuses" }, ...LIFECYCLE_ORDER.map((s) => ({ value: s, label: LIFECYCLE_LABELS[s] }))]} onChange={(value) => setParam({ status: value || undefined })} />
        <FilterSelect label="Sites" value={filters.brandId ?? ""} options={[{ value: "", label: "All sites" }, ...data.brands.map((b) => ({ value: b.id, label: b.name }))]} onChange={(value) => setParam({ brand: value || undefined })} />
        <FilterSelect label="Categories" value={filters.category ?? ""} options={[{ value: "", label: "All categories" }, ...data.categories.map((c) => ({ value: c, label: c }))]} onChange={(value) => setParam({ category: value || undefined })} />
        <DateFilter value={filters.from} placeholder="From date" onChange={(value) => setParam({ from: value })} />
        <DateFilter value={filters.to} placeholder="To date" onChange={(value) => setParam({ to: value })} />
        <button type="button" disabled={!filters.q && !filters.status && !filters.brandId && !filters.category && !filters.from && !filters.to} className="btn-ghost h-11 rounded-[10px] whitespace-nowrap px-3 text-[14px] disabled:cursor-not-allowed disabled:opacity-50" onClick={() => { setQ(""); router.push("/leads"); }}>Clear</button>
        <button type="button" className="btn-ghost h-11 rounded-[10px] whitespace-nowrap px-3 text-[14px]" onClick={exportCsv}>Export CSV</button>
        </div>
      </section>

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
      <section className="card overflow-hidden p-0">
        <div className="max-h-[620px] overflow-auto">
        <table className="w-full min-w-[860px] border-collapse">
          <thead className="sticky top-0 z-10 bg-[#F8FAFC] text-left">
            <tr>
              <th className="w-8 th"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
              <th className="th">Category</th>
              <th className="th text-right">Price</th>
              <th className="th">Site</th>
              <th className="th">Source</th>
              <th className="th">Status</th>
              <th className="th">Captured</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-faint">No leads match these filters.</td></tr>
            )}
            {data.rows.map((l) => (
              <tr key={l.id} className={`border-t border-line/70 transition-colors hover:bg-[#faf9ff] ${sel.has(l.id) ? "bg-primary/5" : ""}`}>
                <td className="td py-2.5"><input type="checkbox" checked={sel.has(l.id)} onChange={() => toggle(l.id)} /></td>
                <td className="td max-w-[260px] truncate py-2.5 font-medium">{l.category}</td>
                <td className="td py-2.5 text-right tabular-nums">{l.priceUsd ? `$${l.priceUsd.toFixed(0)}` : "—"}</td>
                <td className="td py-2.5 text-dim">{l.brandName}</td>
                <td className="td mono py-2.5 text-xs text-faint">{l.source}</td>
                <td className="td py-2.5"><Pill s={l.lifecycle} /></td>
                <td className="td py-2.5 text-xs text-faint">{new Date(l.createdAt).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-dim">
        <span>Showing {data.rows.length} of {data.total} results</span>
        <div className="flex items-center gap-2">
          <span className="text-xs">Page {data.page} / {pages}</span>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim disabled:opacity-50" disabled={data.page <= 1} onClick={() => setParam({ page: String(data.page - 1) })} aria-label="Previous page">‹</button>
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm" aria-current="page">{data.page}</button>
          <button className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim disabled:opacity-50" disabled={data.page >= pages} onClick={() => setParam({ page: String(data.page + 1) })} aria-label="Next page">›</button>
        </div>
      </div>
      </section>
    </div>
  );
}
