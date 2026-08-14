"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { regeneratePageAction, addContentAction } from "@/app/actions/manage";

export function Regen({ brandId, pageId }: { brandId: string; pageId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  const run = (fn: () => Promise<any>) => start(async () => {
    setMsg(null);
    const r = await fn();
    if (r && r.ok === false) setMsg(r.reason ?? "failed");
    router.refresh();
  });

  return (
    <div className="flex items-center justify-end gap-2">
      {msg && <span className="text-xs text-bad">{msg}</span>}
      <button className="btn-ghost btn-sm" disabled={pending}
        onClick={() => run(() => addContentAction(brandId, pageId))} title="Append a new content section (grows the page)">
        {pending ? "…" : "Add content"}
      </button>
      <button className="btn-ghost btn-sm" disabled={pending}
        onClick={() => run(() => regeneratePageAction(brandId, pageId))} title="Regenerate the whole page">
        Regenerate
      </button>
    </div>
  );
}
