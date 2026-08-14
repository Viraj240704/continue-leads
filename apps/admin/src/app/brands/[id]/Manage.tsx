"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBriefAction, deleteAssetAction, setLogoAction, checkDomainAction, purchaseDomainAction } from "@/app/actions/manage";
import { CloseIcon } from "@/components/Icons";

interface Asset { id: string; kind: string; filename: string; text_content: string; content_type: string }

export function Manage(props: {
  brandId: string; brief: string; domain: string; domainStatus: string; logoAssetId: string | null; assets: Asset[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [brief, setBrief] = useState(props.brief);
  const [briefSaved, setBriefSaved] = useState(Boolean(props.brief.trim()));
  const [editingBrief, setEditingBrief] = useState(!props.brief.trim());
  const briefRef = useRef<HTMLTextAreaElement>(null);
  const refresh = () => router.refresh();
  const editBrief = () => {
    setEditingBrief(true);
    requestAnimationFrame(() => {
      const textarea = briefRef.current;
      if (textarea) {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      }
    });
  };

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(220px,1fr)] md:grid-rows-[auto_auto] lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
      {/* Domain */}
      <DomainPanel brandId={props.brandId} domain={props.domain} domainStatus={props.domainStatus} onChange={refresh} />

      {/* Brief */}
      <div className="card flex flex-col">
        <div className="mb-1 flex items-center justify-between gap-4">
          <h3 className="font-semibold">Content brief</h3>
          <button className="btn btn-sm" disabled={pending}
            onClick={() => briefSaved && !editingBrief ? editBrief() : start(async () => { await updateBriefAction(props.brandId, brief); setBriefSaved(true); setEditingBrief(false); refresh(); })}>
            {briefSaved && !editingBrief ? "Edit Brief" : "Save Brief"}
          </button>
        </div>
        <p className="mb-2 text-xs text-faint">Extra instructions the generator uses (emphasis, differentiators). Applied on next generate.</p>
        <textarea ref={briefRef} className="input min-h-[110px] flex-1" value={brief} disabled={briefSaved && !editingBrief} onChange={(e) => setBrief(e.target.value)}
          placeholder="e.g. Emphasize family-owned since 1998, eco-friendly low-VOC paints, and same-week scheduling." />
      </div>

      {/* Assets */}
      <div className="md:col-start-2 md:row-span-2 md:row-start-1"><AssetsPanel brandId={props.brandId} assets={props.assets} logoAssetId={props.logoAssetId} onChange={refresh} /></div>
    </div>
  );
}

function DomainPanel({ brandId, domain, domainStatus, onChange }: { brandId: string; domain: string; domainStatus: string; onChange: () => void }) {
  const [pending, start] = useTransition();
  const [q, setQ] = useState(domain);
  const [quote, setQuote] = useState<any>(null);
  const [note, setNote] = useState<string | null>(null);

  return (
    <div className="card">
      <h3 className="mb-1 font-semibold">Domain</h3>
      <p className="mb-2 text-xs text-faint">
        Current: <span className="font-mono">{domain}</span>{" "}
        <span className={`pill ${domainStatus === "purchased" ? "bg-ok/12 text-ok" : "bg-faint/12 text-faint"}`}>{domainStatus}</span>
      </p>
      <div className="flex gap-2">
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="brand.com" />
        <button className="btn-ghost" disabled={pending}
          onClick={() => start(async () => { setNote(null); setQuote(await checkDomainAction(q)); })}>Check</button>
      </div>
      {quote && (
        <div className="hidden">
          <div className="flex items-center justify-between">
            <span className="font-mono">{quote.domain}</span>
            {quote.available
              ? <span className="pill bg-ok/12 text-ok">available · ${quote.priceUsd}/yr</span>
              : <span className="pill bg-bad/12 text-bad">taken</span>}
          </div>
          {quote.available && (
            <button className="btn mt-1" disabled={pending}
              onClick={() => start(async () => {
                const r = await purchaseDomainAction(brandId, quote.domain);
                setNote(r.ok ? `Registered ${quote.domain} (simulated, $${r.priceUsd})` : `Failed: ${r.reason}`);
                if (r.ok) onChange();
              })}>Register (simulated)</button>
          )}
          {!quote.available && quote.suggestions?.length > 0 && (
            <div className="pt-1">
              <div className="text-xs text-faint">Available alternatives:</div>
              {quote.suggestions.filter((s: any) => s.available).slice(0, 3).map((s: any) => (
                <div key={s.domain} className="flex items-center justify-between">
                  <span className="font-mono text-xs">{s.domain}</span>
                  <button className="text-xs text-accent hover:underline" disabled={pending}
                    onClick={() => start(async () => { const r = await purchaseDomainAction(brandId, s.domain); setNote(r.ok ? `Registered ${s.domain}` : r.reason ?? ""); if (r.ok) onChange(); })}>
                    register ${s.priceUsd}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {quote && <DomainResultModal quote={quote} pending={pending} onClose={() => setQuote(null)} onRegister={(domainToBuy) => start(async () => {
        const r = await purchaseDomainAction(brandId, domainToBuy);
        setNote(r.ok ? `Registered ${domainToBuy} (simulated, $${r.priceUsd})` : `Failed: ${r.reason ?? "registration failed"}`);
        if (r.ok) onChange();
      })} />}
      {note && <p className="mt-2 text-xs text-accent">{note}</p>}
      <p className="mt-2 text-[11px] text-dim">Registration is simulated — no real purchase occurs.</p>
    </div>
  );
}

function DomainResultModal({ quote, pending, onClose, onRegister }: { quote: any; pending: boolean; onClose: () => void; onRegister: (domain: string) => void }) {
  return <div className="fixed inset-0 z-50 grid place-items-center bg-ink/25 p-4" role="presentation" onMouseDown={onClose}>
    <div className="card w-full max-w-md p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="domain-result-title" onMouseDown={(e) => e.stopPropagation()}>
      <div className="flex items-start justify-between gap-4"><div><h2 id="domain-result-title" className="font-semibold">Domain check result</h2><p className="mt-1 font-mono text-sm text-dim">{quote.domain}</p></div><button type="button" className="grid h-8 w-8 place-items-center rounded-lg text-faint hover:bg-raised hover:text-ink" onClick={onClose} aria-label="Close"><CloseIcon size={17} /></button></div>
      <div className="mt-5 flex items-center justify-between"><span className="text-sm font-semibold">Status</span><span className={`pill ${quote.available ? "bg-ok/12 text-ok" : "bg-bad/12 text-bad"}`}>{quote.available ? "Available" : "Taken"}</span></div>
      {quote.available ? <button className="btn mt-5 w-full" disabled={pending} onClick={() => onRegister(quote.domain)}>Register ${quote.priceUsd}</button> : quote.suggestions?.length > 0 && <div className="mt-5"><p className="mb-2 text-sm font-semibold">Available alternatives</p><div className="space-y-2">{quote.suggestions.filter((s: any) => s.available).slice(0, 3).map((s: any) => <button key={s.domain} type="button" className="flex w-full items-center justify-between rounded-lg border border-line px-3 py-2.5 text-left text-sm transition hover:border-primary hover:bg-primary/5" disabled={pending} onClick={() => onRegister(s.domain)}><span className="font-mono">{s.domain}</span><span className="font-semibold text-accent">Register ${s.priceUsd}</span></button>)}</div></div>}
      <p className="mt-5 text-[11px] text-dim">Registration is simulated — no real purchase occurs.</p>
    </div>
  </div>;
}

function AssetsPanel({ brandId, assets, logoAssetId, onChange }: { brandId: string; assets: Asset[]; logoAssetId: string | null; onChange: () => void }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aboutText, setAboutText] = useState("");
  const logoRef = useRef<HTMLInputElement>(null);
  const docRef = useRef<HTMLInputElement>(null);

  async function upload(kind: string, file?: File, text?: string) {
    setErr(null); setBusy(true);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      if (file) fd.set("file", file);
      if (text) fd.set("text", text);
      const res = await fetch(`/api/brands/${brandId}/assets`, { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) setErr(j.error ?? "upload failed");
      else { setAboutText(""); onChange(); }
    } catch (e: any) { setErr(e?.message ?? "upload failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="card">
      <h3 className="mb-1 font-semibold">Assets</h3>
      <p className="mb-2 text-xs text-faint">Logo appears on the site; about-us text feeds the About page. Re-generate to apply.</p>

      <div className="space-y-2">
        <div>
          <label className="label">Logo (image)</label>
          <input ref={logoRef} type="file" accept="image/*" className="text-xs"
            onChange={(e) => e.target.files?.[0] && upload("logo", e.target.files[0])} />
        </div>
        <div>
          <label className="label">Document / image</label>
          <input ref={docRef} type="file" className="text-xs"
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0].type.startsWith("image/") ? "image" : "document", e.target.files[0])} />
        </div>
        <div>
          <label className="label">About-us text</label>
          <textarea className="input min-h-[70px]" value={aboutText} onChange={(e) => setAboutText(e.target.value)} placeholder="Tell the story of the business…" />
          <button className="btn-ghost mt-1" disabled={busy || !aboutText.trim()} onClick={() => upload("about", undefined, aboutText)}>Add about text</button>
        </div>
      </div>

      {busy && <p className="mt-2 text-xs text-faint">Uploading…</p>}
      {err && <p className="mt-2 text-xs text-bad">{err}</p>}

      <ul className="mt-3 space-y-1">
        {assets.length === 0 && <li className="text-xs text-dim">No assets yet.</li>}
        {assets.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="truncate">
              <span className="pill bg-faint/12 text-dim mr-1">{a.kind}</span>
              {a.kind === "logo" && <img src={`/api/assets/${a.id}`} alt="" className="mr-1 inline h-4 align-middle" />}
              {a.filename || (a.text_content ? a.text_content.slice(0, 40) + "…" : a.id.slice(0, 8))}
              {a.id === logoAssetId && <span className="ml-1 text-ok">(active logo)</span>}
            </span>
            <span className="flex gap-2">
              {a.kind === "logo" && a.id !== logoAssetId && (
                <button className="text-accent hover:underline" disabled={pending} onClick={() => start(async () => { await setLogoAction(brandId, a.id); onChange(); })}>use</button>
              )}
              <button className="text-bad hover:underline" disabled={pending} onClick={() => start(async () => { await deleteAssetAction(brandId, a.id); onChange(); })}>delete</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
