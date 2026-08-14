"use client";
import { useMemo, useRef, useState } from "react";
import { GEO } from "@/lib/geo-data";

export interface GeoSelection {
  states: string[];  // state codes
  cities: string[];  // "STATE|City"
  zips: string[];    // zip codes
}

// Hierarchical State -> City -> ZIP multi-select. Selecting a city is what drives
// page generation; ZIPs refine targeting. A CSV/XLSX template can pre-fill selections.
export function GeoSelect({
  value, onChange,
}: { value: GeoSelection; onChange: (v: GeoSelection) => void }) {
  const [openState, setOpenState] = useState<string | null>(null);
  const [openCity, setOpenCity] = useState<string | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const sel = value;
  const cityKey = (st: string, c: string) => `${st}|${c}`;

  function toggleState(code: string) {
    const st = GEO.find((s) => s.code === code)!;
    const has = sel.states.includes(code);
    if (has) {
      // deselect state + its cities + zips
      const cityKeys = st.cities.map((c) => cityKey(code, c.name));
      const zipSet = new Set(st.cities.flatMap((c) => c.zips));
      onChange({
        states: sel.states.filter((s) => s !== code),
        cities: sel.cities.filter((c) => !cityKeys.includes(c)),
        zips: sel.zips.filter((z) => !zipSet.has(z)),
      });
    } else {
      // select state + all its cities (zips left opt-in)
      const cityKeys = st.cities.map((c) => cityKey(code, c.name));
      onChange({
        states: [...sel.states, code],
        cities: Array.from(new Set([...sel.cities, ...cityKeys])),
        zips: sel.zips,
      });
      setOpenState(code);
    }
  }

  function toggleCity(st: string, city: string) {
    const key = cityKey(st, city);
    const has = sel.cities.includes(key);
    const zips = GEO.find((s) => s.code === st)!.cities.find((c) => c.name === city)!.zips;
    if (has) {
      const zipSet = new Set(zips);
      onChange({ ...sel, cities: sel.cities.filter((c) => c !== key), zips: sel.zips.filter((z) => !zipSet.has(z)) });
    } else {
      onChange({ ...sel, states: Array.from(new Set([...sel.states, st])), cities: [...sel.cities, key] });
    }
  }

  function toggleZip(zip: string) {
    onChange(sel.zips.includes(zip) ? { ...sel, zips: sel.zips.filter((z) => z !== zip) } : { ...sel, zips: [...sel.zips, zip] });
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

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-dim">Selected: <b>{sel.cities.length}</b> cities · <b>{sel.zips.length}</b> ZIPs across <b>{sel.states.length}</b> states</p>
        <div className="flex items-center gap-2">
          <a href="/api/geo/template" className="text-xs text-accent hover:underline">Download template</a>
          <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()}>Upload selections</button>
          <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden"
            onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
        </div>
      </div>
      {uploadMsg && <p className="mb-2 text-xs text-data">{uploadMsg}</p>}

      <div className="max-h-72 overflow-y-auto rounded-[var(--r)] border border-line divide-y divide-line">
        {GEO.map((st) => {
          const stateChecked = sel.states.includes(st.code);
          const cityCount = st.cities.filter((c) => sel.cities.includes(cityKey(st.code, c.name))).length;
          return (
            <div key={st.code}>
              <div className="flex items-center gap-2 px-3 py-2">
                <input type="checkbox" checked={stateChecked} onChange={() => toggleState(st.code)} />
                <button type="button" className="flex-1 text-left text-sm font-medium"
                  onClick={() => setOpenState(openState === st.code ? null : st.code)}>
                  {st.name} <span className="text-faint">({st.code})</span>
                  {cityCount > 0 && <span className="ml-2 text-xs text-primary">{cityCount} selected</span>}
                </button>
                <button type="button" className="text-faint text-xs" onClick={() => setOpenState(openState === st.code ? null : st.code)}>
                  {openState === st.code ? "▾" : "▸"}
                </button>
              </div>

              {openState === st.code && (
                <div className="bg-raised/40 pl-8">
                  {st.cities.map((city) => {
                    const key = cityKey(st.code, city.name);
                    const cityChecked = sel.cities.includes(key);
                    const zipSel = city.zips.filter((z) => sel.zips.includes(z)).length;
                    return (
                      <div key={city.name}>
                        <div className="flex items-center gap-2 px-3 py-1.5">
                          <input type="checkbox" checked={cityChecked} onChange={() => toggleCity(st.code, city.name)} />
                          <button type="button" className="flex-1 text-left text-sm"
                            onClick={() => setOpenCity(openCity === key ? null : key)}>
                            {city.name}
                            {zipSel > 0 && <span className="ml-2 text-xs text-primary">{zipSel} ZIPs</span>}
                          </button>
                          <button type="button" className="text-faint text-xs" onClick={() => setOpenCity(openCity === key ? null : key)}>
                            {openCity === key ? "▾" : "▸"}
                          </button>
                        </div>
                        {openCity === key && (
                          <div className="flex flex-wrap gap-1.5 px-3 pb-2 pl-8">
                            {city.zips.map((zip) => (
                              <label key={zip} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-0.5 text-xs ${sel.zips.includes(zip) ? "border-primary bg-primary/10 text-primary" : "border-line text-dim"}`}>
                                <input type="checkbox" className="hidden" checked={sel.zips.includes(zip)} onChange={() => toggleZip(zip)} />
                                {zip}
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
