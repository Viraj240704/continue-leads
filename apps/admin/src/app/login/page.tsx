"use client";
import { useActionState, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { EyeIcon, LockIcon, MailIcon } from "@/components/Icons";

function ShieldIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6l8-3Z" /><path d="m8.5 12 2.2 2.2 4.8-4.8" /></svg>;
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="login-page">
      <section className="login-brand-panel" aria-label="ContinueLeads introduction">
        <div className="login-brand-glow login-brand-glow-purple" />
        <div className="login-brand-glow login-brand-glow-orange" />
        <svg className="login-wave-decoration" viewBox="0 0 460 360" fill="none" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => <path key={index} d={`M-30 ${310 - index * 29} C 70 ${180 - index * 7}, 100 ${390 - index * 13}, 220 ${285 - index * 8} S 365 ${275 - index * 5}, 475 ${350 - index * 7}`} />)}
        </svg>
        <div className="login-brand-content">
          <img src="/Logo_PNG.png" alt="ContinueLeads" className="login-brand-logo" />
          <h1>Powering smarter connections</h1>
          <p>ContinueLeads helps you manage sites, leads and teams — all in one place.</p>
        </div>
      </section>

      <section className="login-form-panel" aria-label="Sign in">
        <div className="login-form-wrap">
          <div className="login-card">
            <h2>Sign in</h2>
            <p className="login-subtitle">Access your account to continue</p>
            <form action={action} className="login-form">
              <div>
                <label htmlFor="email" className="login-label">Email</label>
                <div className="login-input-wrap"><MailIcon size={22} className="login-input-icon" /><input id="email" name="email" type="email" required defaultValue="admin@continueleads.test" className="login-input mono" /></div>
              </div>
              <div>
                <label htmlFor="password" className="login-label">Password</label>
                <div className="login-input-wrap"><LockIcon size={22} className="login-input-icon" /><input id="password" name="password" type={showPassword ? "text" : "password"} required defaultValue="ChangeMe!123" className="login-input mono login-password-input" /><button type="button" className="login-icon-button" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword((visible) => !visible)}><EyeIcon size={22} /></button></div>
              </div>
              {state?.error && <p className="login-error text-bad">{state.error}</p>}
              <div className="login-options">
                <label className="login-remember"><input type="checkbox" /><span>Remember me</span></label>
                <button type="button" className="login-forgot">Forgot password?</button>
              </div>
              <button className="login-submit" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
            </form>
          </div>
          <div className="login-secure"><ShieldIcon /><span>Secure and protected</span></div>
        </div>
      </section>
    </main>
  );
}
