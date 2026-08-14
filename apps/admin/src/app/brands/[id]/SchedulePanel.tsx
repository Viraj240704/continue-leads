"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reschedulePageAction } from "@/app/actions/manage";

interface SlotRow { page_id: string; path: string; wave: number; status: string; scheduled_at: string }

// ISO -> value for <input type="datetime-local"> in the viewer's local time.
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SchedulePanel({ brandId, waves }: { brandId: string; waves: SlotRow[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  if (waves.length === 0) {
    return <div className="card text-sm text-dim">No schedule yet. Approve pages, then <b>Build schedule</b> — or set go-live dates here once scheduled.</div>;
  }

  const grouped = Object.entries(
    waves.reduce((m: Record<number, SlotRow[]>, w) => ((m[w.wave] = m[w.wave] ?? []).push(w), m), {})
  ).sort((a, b) => Number(a[0]) - Number(b[0]));

  return (
    <div className="card space-y-4">
      {grouped.map(([wave, items]) => (
        <div key={wave}>
          <div className="mb-1.5 flex items-center gap-2">
            <span className="section-title">{Number(wave) === 0 ? "Launch wave" : `Week ${wave}`}</span>
            <span className="text-xs text-faint mono">{items.length}</span>
          </div>
          <ul className="space-y-1.5">
            {items.map((it) => (
              <li key={it.page_id} className="flex items-center justify-between gap-2">
                <span className="mono truncate text-xs text-dim" title={it.path}>{it.path}</span>
                {it.status === "published" ? (
                  <span className="pill bg-amber/15 text-amber">live</span>
                ) : (
                  <input
                    type="datetime-local"
                    defaultValue={toLocalInput(it.scheduled_at)}
                    suppressHydrationWarning
                    className="input mono w-[190px] px-2 py-1 text-xs"
                    disabled={pending}
                    onChange={(e) => {
                      const iso = new Date(e.target.value).toISOString();
                      start(async () => {
                        const r = await reschedulePageAction(brandId, it.page_id, iso);
                        setMsg(r.ok ? `Moved ${it.path}` : r.reason ?? "Failed");
                        router.refresh();
                      });
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
      {msg && <p className="text-xs text-data">{msg}</p>}
      <p className="text-[11px] text-faint">Change a date to move when that page goes live. The next publisher tick promotes any page whose time has passed (and whose parent pages are already live).</p>
    </div>
  );
}
