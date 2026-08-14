"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CADENCES, type BlogConfig, type Cadence } from "@/lib/blog";
import { saveBlogAction } from "@/app/actions/blog";

export function BlogPanel({ brandId, domain, config, canWrite }: { brandId: string; domain: string; config: BlogConfig; canWrite: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [b, setB] = useState<BlogConfig>(config);
  const [topicsRaw, setTopicsRaw] = useState((config.topics ?? []).join(", "));
  const [msg, setMsg] = useState<string | null>(null);
  const host = (domain || "yoursite.com").replace(/^https?:\/\//, "");

  function save() {
    start(async () => {
      setMsg(null);
      const cfg = { ...b, topics: topicsRaw.split(",").map((t) => t.trim()).filter(Boolean) };
      const r = await saveBlogAction(brandId, cfg);
      setMsg(r.created ? `Saved — created ${r.created} blog page(s).` : "Saved.");
      router.refresh();
    });
  }

  return (
    <div className="card">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold">Blog</h2>
        <button type="button" disabled={!canWrite} aria-pressed={b.enabled}
          onClick={() => setB({ ...b, enabled: !b.enabled })}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium ${b.enabled ? "border-primary bg-primary/10 text-primary" : "border-line text-dim hover:text-ink"}`}>
          <span className={`relative h-5 w-9 rounded-full ${b.enabled ? "bg-primary" : "bg-line"}`}>
            <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${b.enabled ? "left-[18px]" : "left-0.5"}`} />
          </span>
          {b.enabled ? "Enabled" : "Enable"}
        </button>
      </div>

      {!b.enabled ? (
        <p className="text-xs text-dim">This site has no blog. Turn it on to add a cadence-published blog.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <label className="block"><span className="label">Cadence</span>
              <select className="input" value={b.cadence} onChange={(e) => setB({ ...b, cadence: e.target.value as Cadence })}>
                {CADENCES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </label>
            <label className="block"><span className="label">Posts / run</span>
              <input className="input" type="number" min={1} value={b.postsPerRun} onChange={(e) => setB({ ...b, postsPerRun: Number(e.target.value) })} />
            </label>
            <label className="block"><span className="label">Add posts now</span>
              <input className="input" type="number" min={0} value={b.initialPosts} onChange={(e) => setB({ ...b, initialPosts: Number(e.target.value) })} />
            </label>
            <label className="block"><span className="label">URL prefix</span>
              <input className="input mono" value={b.urlPrefix} onChange={(e) => setB({ ...b, urlPrefix: e.target.value })} />
            </label>
          </div>
          <label className="block"><span className="label">Topic focus areas (comma-separated)</span>
            <input className="input" value={topicsRaw} onChange={(e) => setTopicsRaw(e.target.value)} placeholder="cabinet painting, color trends" />
          </label>
          <p className="text-[11px] text-faint">Posts publish under <span className="mono">{host}{b.urlPrefix}</span>. &quot;Add posts now&quot; generates that many immediately; the rest follow the cadence.</p>
        </div>
      )}

      {canWrite && (
        <div className="mt-3 flex items-center gap-2 [&>button]:hidden">
          <button className="btn btn-sm" disabled={pending} onClick={save}>{pending ? "Working…" : b.enabled ? "Save & generate" : "Save"}</button>
          {msg && <span className="text-xs text-ok">{msg}</span>}
        </div>
      )}
    </div>
  );
}
