"use client";
import { useEffect, useRef, useState } from "react";
import { GEO } from "@/lib/geo-data";

export interface GeoSelection {
  states: string[];  // state codes
  cities: string[];  // "STATE|City"
  zips: string[];    // zip codes
}

const PAGE_SIZE = 8;

const cityKey = (st: string, c: string) => `${st}|${c}`;

function getCityRecord(stateCode: string, cityName: string) {
  return GEO.find((state) => state.code === stateCode)?.cities.find((city) => city.name === cityName) ?? null;
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
}

// ─── Large Popup Modal for State ───────────────────────────────────────────
function StateModal({
  stateCode,
  sel,
  onChange,
  onClose,
}: {
  stateCode: string;
  sel: GeoSelection;
  onChange: (v: GeoSelection) => void;
  onClose: () => void;
}) {
  const st = GEO.find((s) => s.code === stateCode)!;
  // local draft so Apply/Cancel works
  const [draft, setDraft] = useState<GeoSelection>(sel);
  const initialActiveCity = sel.cities.find((city) => city.startsWith(`${stateCode}|`))?.split("|")[1] ?? st.cities[0]?.name ?? "";
  const [activeCity, setActiveCity] = useState<string>(initialActiveCity);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDraft(sel);
    const nextActiveCity = sel.cities.find((city) => city.startsWith(`${stateCode}|`))?.split("|")[1] ?? st.cities[0]?.name ?? "";
    setActiveCity(nextActiveCity);
  }, [sel, stateCode, st.cities]);

  // Close modal on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const selectedCount = st.cities.filter((c) => draft.cities.includes(cityKey(stateCode, c.name))).length;

  function toggleCity(cityName: string) {
    const key = cityKey(stateCode, cityName);
    const city = getCityRecord(stateCode, cityName);
    if (!city) return;
    const zipSet = new Set(city.zips);
    const hasCity = draft.cities.includes(key);

    setDraft({
      ...draft,
      states: Array.from(new Set([...draft.states, stateCode])),
      cities: hasCity ? draft.cities.filter((item) => item !== key) : [...draft.cities, key],
      zips: hasCity ? draft.zips.filter((zip) => !zipSet.has(zip)) : draft.zips,
    });
  }

  function toggleZip(zip: string) {
    if (!activeCityData) return;
    const key = cityKey(stateCode, activeCityData.name);
    const nextZipSelected = !draft.zips.includes(zip);
    const nextCities = nextZipSelected && !draft.cities.includes(key) ? [...draft.cities, key] : draft.cities;

    setDraft({
      ...draft,
      states: Array.from(new Set([...draft.states, stateCode])),
      cities: nextCities,
      zips: toggleValue(draft.zips, zip),
    });
  }

  const activeCityData = st.cities.find((c) => c.name === activeCity);
  const activeCityKey = activeCityData ? cityKey(stateCode, activeCityData.name) : "";
  const activeCitySelected = activeCityKey ? draft.cities.includes(activeCityKey) : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4">
      {/* Backdrop click close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div
        ref={modalRef}
        className="relative flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-line/70 bg-[linear-gradient(180deg,rgba(248,250,252,0.96),rgba(255,255,255,0.98))] shadow-[0_28px_80px_rgba(15,23,42,0.22)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line/60 px-6 py-5 bg-white/70 backdrop-blur">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Geography detail</p>
            <h3 className="mt-1 text-lg font-bold text-ink">{st.name}</h3>
            <p className="mt-1 text-xs text-dim">{selectedCount} / {st.cities.length} cities selected</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-line/80 bg-white p-2 text-faint transition-colors hover:text-ink">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Body */}
        <div className="grid flex-1 gap-0 overflow-hidden lg:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <div
            className="space-y-4 overflow-y-auto p-6 [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <div className="rounded-3xl border border-primary/10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.12),transparent_55%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(248,250,252,0.88))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">State coverage</p>
                  <h4 className="mt-1 text-sm font-semibold text-ink">Choose the cities you want this plan to target</h4>
                </div>
                <span className="rounded-full border border-primary/15 bg-white/80 px-3 py-1 text-xs font-semibold text-primary">
                  {selectedCount} selected
                </span>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="text-xs font-bold uppercase tracking-wider text-faint">Cities</div>
              <div className="grid gap-2 sm:grid-cols-2">
              {st.cities.map((city) => {
                const key = cityKey(stateCode, city.name);
                const isSelected = draft.cities.includes(key);
                const isActive = activeCity === city.name;
                return (
                  <button
                    key={city.name}
                    type="button"
                    onClick={() => setActiveCity(city.name)}
                    className={`rounded-2xl border px-3.5 py-3 text-left transition-all ${
                      isActive
                        ? "border-primary/30 bg-primary/5 shadow-[0_10px_24px_rgba(59,130,246,0.10)]"
                        : "border-line/80 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className={`truncate text-sm font-semibold ${isSelected ? "text-primary" : "text-ink"}`}>{city.name}</div>
                        <div className="mt-1 text-[11px] text-dim">{city.zips.length} ZIP codes available</div>
                      </div>
                      <span
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleCity(city.name);
                        }}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                          isSelected ? "border-primary bg-primary text-white" : "border-line bg-white text-transparent"
                        }`}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          <path d="m5 12 5 5L20 7" />
                        </svg>
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          </div>

          {activeCityData && (
            <div className="border-t border-line/50 bg-[linear-gradient(180deg,rgba(241,245,249,0.7),rgba(255,255,255,0.98))] p-6 lg:border-l lg:border-t-0">
              <div className="flex h-full flex-col rounded-[24px] border border-line/70 bg-white/92 p-5 shadow-[0_20px_40px_rgba(15,23,42,0.08)]">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">ZIP targeting</p>
                    <h4 className="mt-1 text-base font-semibold text-ink">{activeCity}</h4>
                    <p className="mt-1 text-xs text-dim">Select specific ZIPs, or leave them empty to target the whole city.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleCity(activeCityData.name)}
                    className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                      activeCitySelected
                        ? "border-primary/20 bg-primary/10 text-primary hover:bg-primary/15"
                        : "border-line bg-white text-dim hover:text-ink"
                    }`}
                  >
                    {activeCitySelected ? "Deselect city" : "Select city"}
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-line/60 bg-slate-50/70 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-ink">{activeCityData.zips.length} ZIP codes</span>
                    <span className="text-dim">{activeCitySelected ? "City selected" : "ZIP selection will auto-select this city"}</span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {activeCityData.zips.map((zip) => {
                    const isZipSelected = draft.zips.includes(zip);
                    return (
                      <button
                        key={zip}
                        type="button"
                        onClick={() => toggleZip(zip)}
                        className={`rounded-xl border px-3 py-2 text-xs font-mono transition-all ${
                          isZipSelected
                            ? "border-primary bg-primary/10 font-semibold text-primary shadow-[0_8px_20px_rgba(59,130,246,0.10)]"
                            : "border-line bg-white text-dim hover:bg-slate-50"
                        }`}
                      >
                        {zip}
                      </button>
                    );
                  })}
                </div>

                <p className="mt-auto pt-4 text-[11px] leading-5 text-faint">
                  Selecting a ZIP automatically selects <span className="font-semibold text-ink">{activeCity}</span>. Deselecting the city removes its ZIP selections too.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-line/60 bg-white/80 px-6 py-4 backdrop-blur">
          <button
            type="button"
            onClick={() => {
              setDraft(sel);
              setActiveCity(sel.cities.find((city) => city.startsWith(`${stateCode}|`))?.split("|")[1] ?? st.cities[0]?.name ?? "");
            }}
            className="text-xs font-semibold text-dim transition-colors hover:text-ink"
          >
            Reset
          </button>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-dim hover:text-ink transition-colors px-3 py-2"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => { onChange(draft); onClose(); }}
              className="btn bg-primary text-white text-xs px-4 py-2 rounded-lg font-semibold shadow-sm"
            >
              Apply selections
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export function GeoSelect({
  value, onChange,
}: { value: GeoSelection; onChange: (v: GeoSelection) => void }) {
  const [page, setPage] = useState(0);
  const [openState, setOpenState] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sel = value;
  const totalPages = Math.ceil(GEO.length / PAGE_SIZE);
  const pageStates = GEO.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function toggleState(code: string) {
    const has = sel.states.includes(code);
    if (has) {
      const st = GEO.find((s) => s.code === code)!;
      const keys = st.cities.map((c) => cityKey(code, c.name));
      const zipSet = new Set(st.cities.flatMap((c) => c.zips));
      onChange({
        states: sel.states.filter((s) => s !== code),
        cities: sel.cities.filter((c) => !keys.includes(c)),
        zips: sel.zips.filter((z) => !zipSet.has(z)),
      });
      if (openState === code) setOpenState(null);
    } else {
      onChange({
        ...sel,
        states: [...sel.states, code],
      });
      setOpenState(code);
    }
  }

  async function onUpload(file: File) {
    setUploadMsg("Reading template…");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/geo/parse", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) { setUploadMsg(`Error: ${j.error}`); return; }
      onChange(j.selection as GeoSelection);
      setUploadMsg(`Loaded ${j.selection.cities.length} cities, ${j.selection.zips.length} ZIPs (${j.matched} matched, ${j.unmatched} unmatched).`);
    } catch (e: any) { setUploadMsg(`Error: ${e?.message ?? "upload failed"}`); }
  }

  // selected states summary chips
  const selectedStateSummaries = sel.states.map((code) => {
    const st = GEO.find((s) => s.code === code)!;
    if (!st) return null;
    const cities = st.cities.filter((c) => sel.cities.includes(cityKey(code, c.name)));
    return { code, name: st.name, cities };
  }).filter(Boolean) as { code: string; name: string; cities: { name: string; zips: string[] }[] }[];

  return (
    <div className="space-y-4">
      {/* Top bar: summary + actions */}
      <div className="rounded-[24px] border border-line/70 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.10),transparent_48%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.92))] p-4 shadow-[0_18px_40px_rgba(15,23,42,0.06)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
         
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-primary/15 bg-white/90 px-3 py-1.5 text-xs font-semibold text-primary">
              {sel.states.length} states
            </span>
            <span className="rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink">
              {sel.cities.length} cities
            </span>
            <span className="rounded-full border border-line bg-white/90 px-3 py-1.5 text-xs font-semibold text-ink">
              {sel.zips.length} ZIPs
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <p className="text-xs text-dim">
          Selected: <b>{sel.states.length}</b> states · <b>{sel.cities.length}</b> cities · <b>{sel.zips.length}</b> ZIPs
        </p>
        <div className="flex items-center gap-2">
          <a href="/api/geo/template" className="text-xs text-accent hover:underline">Download template</a>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-3 py-1.5 text-xs text-dim transition-colors hover:text-ink animate-fade-in"
            onClick={() => fileRef.current?.click()}
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Upload
          </button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </div>
      </div>
      {uploadMsg && <p className="text-xs text-data">{uploadMsg}</p>}

      {/* State grid + pagination row */}
      <div className="space-y-3 rounded-[24px] border border-line/70 bg-white p-4 shadow-[0_16px_36px_rgba(15,23,42,0.05)]">
        {/* 4×2 grid */}
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {pageStates.map((st) => {
            const selected = sel.states.includes(st.code);
            const cityCount = st.cities.filter((c) => sel.cities.includes(cityKey(st.code, c.name))).length;
            return (
              <div key={st.code} className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (selected) {
                      setOpenState(st.code);
                    } else {
                      toggleState(st.code);
                    }
                  }}
                  className={`w-full flex items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-colors ${
                    selected
                      ? "border-primary/30 bg-primary/5 text-primary shadow-[0_12px_24px_rgba(59,130,246,0.08)]"
                      : "border-line bg-white text-ink hover:bg-slate-50"
                  }`}
                >
                  {/* checkbox */}
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                      selected ? "border-primary bg-primary" : "border-line bg-white"
                    }`}
                    onClick={(e) => { e.stopPropagation(); toggleState(st.code); }}
                  >
                    {selected && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                        <path d="m5 12 5 5L20 7" />
                      </svg>
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold leading-tight">{st.name}</span>
                    <span className="text-[10px] text-faint">{st.code}{cityCount > 0 ? ` · ${cityCount} cities` : ""}</span>
                  </span>
                  {selected && (
                    <svg className="w-3 h-3 shrink-0 text-primary" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                      <path d="M5 12h14" />
                    </svg>
                  )}
                </button>
              </div>
            );
          })}
          {/* Empty placeholders to keep grid stable */}
          {pageStates.length < PAGE_SIZE && Array.from({ length: PAGE_SIZE - pageStates.length }).map((_, i) => (
            <div key={`empty-${i}`} />
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="flex h-6 w-6 items-center justify-center rounded border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M15 18l-6-6 6-6" />
              </svg>
            </button>
            <span className="text-xs text-faint tabular-nums">{page + 1} / {totalPages}</span>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              className="flex h-6 w-6 items-center justify-center rounded border border-line bg-white text-dim hover:bg-raised/40 disabled:opacity-40 disabled:hover:bg-white transition-colors"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Selected states summary */}
      {selectedStateSummaries.length > 0 && (
        <div className="space-y-2 rounded-[24px] border border-line/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-4 py-3 shadow-[0_16px_32px_rgba(15,23,42,0.05)]">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-faint">
              Selected ({sel.states.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {selectedStateSummaries.map((st) => (
              <div key={st.code} className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setOpenState(st.code)}
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  {st.name}
                </button>
                <span className="text-[10px] text-faint">
                  {st.cities.map((c) => {
                    const zipCount = c.zips.filter((z) => sel.zips.includes(z)).length;
                    return `${c.name}${zipCount > 0 ? ` · ${zipCount} ZIPs` : ""}`;
                  }).join(" | ") || "No cities selected"}
                </span>
                <button
                  type="button"
                  onClick={() => toggleState(st.code)}
                  className="text-faint hover:text-bad transition-colors"
                  title={`Remove ${st.name}`}
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Large Modal Popup */}
      {openState && (
        <StateModal
          stateCode={openState}
          sel={sel}
          onChange={onChange}
          onClose={() => setOpenState(null)}
        />
      )}
    </div>
  );
}
