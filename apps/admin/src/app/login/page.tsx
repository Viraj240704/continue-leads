"use client";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { WaveRail } from "@/components/WaveRail";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, {});
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo size={30} />
          <div className="flex items-center gap-2">
            <WaveRail total={20} live={8} sched={5} count={16} />
          </div>
        </div>

        <div className="card">
          <p className="eyebrow mb-1">Control plane</p>
          <h1 className="mb-5 font-display text-xl font-bold">Sign in to the factory</h1>
          <form action={action} className="space-y-4">
            <div>
              <label className="label">Email</label>
              <input name="email" type="email" required defaultValue="admin@continueleads.test" className="input mono" />
            </div>
            <div>
              <label className="label">Password</label>
              <input name="password" type="password" required defaultValue="ChangeMe!123" className="input mono" />
            </div>
            {state?.error && <p className="text-sm text-bad">{state.error}</p>}
            <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
          </form>
        </div>
        <p className="mt-4 text-center text-xs text-faint">Seeded demo credentials are pre-filled.</p>
      </div>
    </div>
  );
}
