"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/rbac";
import { inviteMemberAction, revokeInviteAction, setAutoJoinAction, changeRoleAction } from "@/app/actions/team";
import type { TeamData } from "@/lib/team";

function RoleBadge({ role }: { role: string }) {
  const label = (ROLE_LABELS as Record<string, string>)[role] ?? role;
  const tone = role === "admin" || role === "platform_admin" ? "bg-primary/10 text-primary" : "bg-faint/12 text-dim";
  return <span className={`pill ${tone}`}>{label}</span>;
}

export function TeamManager({ team, currentUserId }: { team: TeamData; currentUserId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ops");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const emailDomainOk = !email.includes("@") || email.trim().toLowerCase().split("@")[1] === team.orgDomain.toLowerCase();

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null); setInviteLink(null);
    start(async () => {
      const r = await inviteMemberAction(email.trim(), role);
      if (!r.ok) { setMsg({ ok: false, text: r.error ?? "Failed to invite." }); return; }
      setMsg({ ok: true, text: `Invited ${email}.` });
      setInviteLink(`${window.location.origin}/invite/${r.token}`);
      setEmail("");
      router.refresh();
    });
  }
  const act = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Members */}
      <div className="space-y-6">
        <section>
          <p className="section-title mb-2">Members ({team.members.length})</p>
          <div className="panel divide-y divide-line overflow-hidden">
            {team.members.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{m.name} {m.id === currentUserId && <span className="text-xs text-faint">(you)</span>}</div>
                  <div className="mono truncate text-xs text-dim">{m.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  {m.id === currentUserId || m.role === "platform_admin" ? (
                    <RoleBadge role={m.role} />
                  ) : (
                    <select
                      className="input h-8 py-0 text-xs"
                      value={ASSIGNABLE_ROLES.includes(m.role as Role) ? m.role : "dev"}
                      disabled={pending}
                      onChange={(e) => act(() => changeRoleAction(m.id, e.target.value as Role))}
                    >
                      {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {team.invites.length > 0 && (
          <section>
            <p className="section-title mb-2">Pending invites ({team.invites.length})</p>
            <div className="panel divide-y divide-line overflow-hidden">
              {team.invites.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="mono truncate text-sm">{i.email}</div>
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/invite/${i.token}`)}
                    >Copy invite link</button>
                  </div>
                  <div className="flex items-center gap-2">
                    <RoleBadge role={i.role} />
                    <button className="btn-ghost btn-sm" disabled={pending} onClick={() => act(() => revokeInviteAction(i.id))}>Revoke</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Invite + settings */}
      <aside className="space-y-6">
        <form onSubmit={invite} className="card">
          <h2 className="mb-1 font-semibold">Invite a teammate</h2>
          <p className="mb-3 text-xs text-dim">Only <span className="mono">@{team.orgDomain || "your-domain"}</span> emails can be invited.</p>
          <label className="label">Email</label>
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={`name@${team.orgDomain || "example.com"}`} />
          {!emailDomainOk && <p className="mt-1 text-xs text-bad">Must be on the @{team.orgDomain} domain.</p>}
          <label className="label mt-3">Role</label>
          <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {ASSIGNABLE_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <p className="mt-1 text-xs text-faint">{ROLE_DESCRIPTIONS[role]}</p>
          <button className="btn mt-3 w-full justify-center" disabled={pending || !emailDomainOk || !email}>
            {pending ? "Working…" : "Send invite"}
          </button>
          {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
          {inviteLink && (
            <div className="mt-2 rounded-md border border-line bg-canvas p-2">
              <p className="mb-1 text-xs text-dim">Share this link (no email is sent):</p>
              <div className="flex items-center gap-1">
                <input readOnly value={inviteLink} className="input h-7 flex-1 py-0 text-xs" />
                <button type="button" className="btn-ghost btn-sm" onClick={() => navigator.clipboard?.writeText(inviteLink)}>Copy</button>
              </div>
            </div>
          )}
        </form>

        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">Auto-join by domain</h3>
              <p className="mt-0.5 text-xs text-dim">Let anyone with a verified <span className="mono">@{team.orgDomain}</span> email join automatically.</p>
            </div>
            <button
              role="switch" aria-checked={team.autoJoin} disabled={pending}
              onClick={() => act(() => setAutoJoinAction(!team.autoJoin))}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${team.autoJoin ? "bg-primary" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${team.autoJoin ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          {team.autoJoin && <p className="mt-2 text-xs text-warn">⚠ Anyone who obtains an @{team.orgDomain} email can join. Keep off unless your domain is tightly controlled.</p>}
        </div>
      </aside>
    </div>
  );
}
