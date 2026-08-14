// Client-safe status pills (no server-only imports — usable from client components).

export function StatePill({ state }: { state: string }) {
  const map: Record<string, string> = {
    draft: "bg-faint/12 text-dim",
    generating: "bg-info/12 text-info",
    generated: "bg-info/12 text-info",
    qa_failed: "bg-bad/12 text-bad",
    approved: "bg-ok/12 text-ok",
    scheduled: "bg-warn/15 text-warn",
    published: "bg-primary/12 text-primary",
    paused: "bg-warn/15 text-warn",
    rolled_back: "bg-violet/12 text-violet",
    active: "bg-ok/12 text-ok",
  };
  return <span className={`pill ${map[state] ?? "bg-faint/12 text-dim"}`}>{state.replace(/_/g, " ")}</span>;
}

export function IndexPill({ state }: { state: string }) {
  return <span className={`pill ${state === "indexable" ? "bg-ok/12 text-ok" : "bg-faint/12 text-faint"}`}>{state}</span>;
}

export function QaPill({ status }: { status?: string | null }) {
  if (!status) return <span className="text-faint">—</span>;
  const map: Record<string, string> = { pass: "bg-ok/12 text-ok", warn: "bg-warn/15 text-warn", fail: "bg-bad/12 text-bad" };
  return <span className={`pill ${map[status]}`}>{status}</span>;
}
