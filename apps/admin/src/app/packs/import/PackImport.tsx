"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function PackImport() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/packs/import", { method: "POST", body: fd });
      const j = await res.json();
      if (!j.ok) { setErr(j.error ?? "import failed"); return; }
      setMsg(`Imported ${j.products} product(s) and ${j.services} service(s): ${j.packs.map((p: any) => p.name).join(", ")}.`);
      router.refresh();
    } catch (e: any) { setErr(e?.message ?? "import failed"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  }

  return (
    <div className="card">
      <h2 className="mb-1 font-semibold">Import from Excel / CSV</h2>
      <p className="mb-3 text-xs text-dim">Columns: <span className="mono">product</span>, <span className="mono">service_name</span>, <span className="mono">hint</span> (optional). One row per service.</p>
      <div className="flex flex-col gap-2">
        <a href="/api/packs/template" className="btn-ghost btn-sm w-fit">Download template</a>
        <button className="btn w-fit" disabled={busy} onClick={() => fileRef.current?.click()}>{busy ? "Importing…" : "Choose file & import"}</button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
      </div>
      {msg && <p className="mt-3 text-xs text-ok">{msg}</p>}
      {err && <p className="mt-3 text-xs text-bad">{err}</p>}
    </div>
  );
}
