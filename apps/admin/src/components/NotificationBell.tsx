"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Notif } from "@/lib/notifications";

const DOT: Record<Notif["kind"], string> = {
  lead: "bg-info", validation: "bg-bad", qa: "bg-warn", golive: "bg-ok",
};

export function NotificationBell({ items }: { items: Notif[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-white text-dim shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#d0d5dd] hover:bg-raised hover:text-ink"
        aria-label="Notifications"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {items.length > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-bad px-1 text-[10px] font-bold text-white">
            {items.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-80 overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
          <div className="border-b border-line px-3 py-2 text-sm font-semibold">Notifications</div>
          {items.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-faint">You&apos;re all caught up.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {items.map((n, i) => (
                <li key={i}>
                  <Link href={n.href} onClick={() => setOpen(false)} className="flex gap-2 px-3 py-2.5 hover:bg-canvas">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${DOT[n.kind]}`} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{n.title}</span>
                      <span className="block text-xs text-dim">{n.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
