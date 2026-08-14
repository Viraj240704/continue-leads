"use client";

import { useEffect, useRef, useState } from "react";

export function FreshnessSelect({ label, options }: { label: string; options: string[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(options[0] ?? "");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <span className="sr-only">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-[36px] w-full items-center justify-between rounded-[10px] border bg-white px-2.5 text-left text-[14px] font-medium text-[#1E293B] transition duration-200 focus:outline-none ${open ? "border-[#5B4BFF] ring-2 ring-[#5B4BFF]/20" : "border-[#D9E1EC] hover:border-[#b9c5d6]"}`}
      >
        <span>{selected}</span>
        <svg className={`h-4 w-4 shrink-0 text-[#475569] transition-transform duration-200 ${open ? "rotate-180" : ""}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      <div className={`absolute left-0 right-0 top-[calc(100%+8px)] z-30 max-h-[180px] origin-top overflow-y-auto scroll-smooth rounded-[10px] border border-[#D9E1EC] bg-white p-1.5 shadow-[0_6px_16px_rgba(15,23,42,.10)] transition duration-200 ${open ? "pointer-events-auto translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`} role="listbox" aria-label={label}>
        <div className="grid gap-0.5">
          {options.map((option) => <button key={option} type="button" role="option" aria-selected={selected === option} onClick={() => { setSelected(option); setOpen(false); }} className={`flex h-[34px] w-full items-center rounded-[8px] px-3 text-left text-[14px] transition-colors ${selected === option ? "bg-[#EEF2FF] font-semibold text-[#5B4BFF]" : "text-[#1E293B] hover:bg-[#E6E9FF]"}`}>{option}</button>)}
        </div>
      </div>
    </div>
  );
}
