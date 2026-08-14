"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acceptInviteAction } from "@/app/actions/invite";

export function AcceptForm({ token }: { token: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    start(async () => {
      const r = await acceptInviteAction(token, name, password);
      if (!r.ok) { setErr(r.error ?? "Could not create account."); return; }
      setDone(true);
      setTimeout(() => router.push("/login"), 1200);
    });
  }

  if (done) return <p className="mt-4 text-sm text-ok">Account created — redirecting to sign in…</p>;

  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <div>
        <label className="label">Your name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="label">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
      </div>
      {err && <p className="text-xs text-bad">{err}</p>}
      <button className="btn w-full justify-center" disabled={pending || name.length < 2 || password.length < 8}>
        {pending ? "Creating…" : "Create account"}
      </button>
    </form>
  );
}
