"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ASSIGNABLE_ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, type Role } from "@/lib/rbac";
import { inviteMemberAction, revokeInviteAction, setAutoJoinAction, changeRoleAction } from "@/app/actions/team";
import type { TeamData } from "@/lib/team";
import { MailIcon, SearchIcon, ShieldCheckIcon, TeamIcon } from "@/components/Icons";

function RoleBadge({ role }: { role: string }) {
  const label = (ROLE_LABELS as Record<string, string>)[role] ?? role;
  const tone =
    role === "admin" || role === "platform_admin"
      ? "bg-primary/10 text-primary"
      : role === "ops"
        ? "bg-info/10 text-info"
        : "bg-faint/12 text-dim";
  return <span className={`pill ${tone}`}>{label}</span>;
}

function InitialAvatar({ name, tone }: { name: string; tone: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "TM";

  return (
    <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-full text-sm font-bold ${tone}`}>
      {initials}
    </div>
  );
}

function avatarTone(index: number) {
  return [
    "bg-primary/15 text-primary",
    "bg-info/15 text-info",
    "bg-ok/15 text-ok",
    "bg-warn/15 text-warn",
  ][index % 4]!;
}

export function TeamManager({ team, currentUserId }: { team: TeamData; currentUserId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("ops");
  const [query, setQuery] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  const emailDomainOk = !email.includes("@") || email.trim().toLowerCase().split("@")[1] === team.orgDomain.toLowerCase();
  const visibleMembers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return team.members;
    return team.members.filter((member) =>
      member.name.toLowerCase().includes(needle) || member.email.toLowerCase().includes(needle)
    );
  }, [query, team.members]);

  function invite(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    setInviteLink(null);
    start(async () => {
      const r = await inviteMemberAction(email.trim(), role);
      if (!r.ok) {
        setMsg({ ok: false, text: r.error ?? "Failed to invite." });
        return;
      }
      setMsg({ ok: true, text: `Invited ${email}.` });
      setInviteLink(`${window.location.origin}/invite/${r.token}`);
      setEmail("");
      router.refresh();
    });
  }

  const act = (fn: () => Promise<any>) => start(async () => { await fn(); router.refresh(); });

  return (
    <div className="space-y-6">
      <section className="card overflow-hidden p-0">
        <div className="border-b border-line px-6 py-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
                <TeamIcon size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-ink">Members ({team.members.length})</h2>
                <p className="mt-1 max-w-[280px] text-xs leading-5 text-dim">Manage access, roles, and pending invites for your workspace.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:min-w-[460px]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block flex-1">
                  <SearchIcon size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    className="input h-10 rounded-xl bg-white pl-9 text-sm"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search members or email..."
                  />
                </label>
                <button
                  type="button"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white px-4 text-sm font-semibold text-primary shadow-sm transition hover:bg-primary/5"
                  onClick={() => document.getElementById("team-invite-email")?.focus()}
                >
                  <TeamIcon size={15} className="text-primary" />
                  <span>Add member</span>
                </button>
              </div>
              <div className="flex items-center justify-between px-1 text-xs text-faint">
                <span>{team.invites.length} pending invite{team.invites.length === 1 ? "" : "s"}</span>
                <span>{visibleMembers.length} result{visibleMembers.length === 1 ? "" : "s"} shown</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div
            className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <table className="w-full min-w-[760px] border-collapse">
              <thead className="bg-raised/40">
                <tr>
                  <th className="th">Member</th>
                  <th className="th">Role</th>
                  <th className="th">Access</th>
                  <th className="th text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {visibleMembers.map((member, index) => (
                  <tr key={member.id}>
                    <td className="td">
                      <div className="flex items-center gap-4">
                        <InitialAvatar name={member.name} tone={avatarTone(index)} />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-semibold text-ink">{member.name}</span>
                            {member.id === currentUserId && <span className="pill bg-primary/10 text-primary">You</span>}
                          </div>
                          <div className="mono mt-1 truncate text-xs text-dim">{member.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="td">
                      {member.id === currentUserId || member.role === "platform_admin" ? (
                        <RoleBadge role={member.role} />
                      ) : (
                        <select
                          className="input h-11 min-w-[148px] rounded-xl py-0 text-sm"
                          value={ASSIGNABLE_ROLES.includes(member.role as Role) ? member.role : "dev"}
                          disabled={pending}
                          onChange={(e) => act(() => changeRoleAction(member.id, e.target.value as Role))}
                        >
                          {ASSIGNABLE_ROLES.map((assignableRole) => (
                            <option key={assignableRole} value={assignableRole}>{ROLE_LABELS[assignableRole]}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="td text-dim">All sites</td>
                    <td className="td text-right">
                      {member.id === currentUserId || member.role === "platform_admin" ? (
                        <span className="text-xs text-faint">Protected</span>
                      ) : (
                        <span className="text-xs text-faint">Role managed inline</span>
                      )}
                    </td>
                  </tr>
                ))}
                {visibleMembers.length === 0 && (
                  <tr>
                    <td className="td text-dim" colSpan={4}>No members match your search.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-3.5 text-xs text-dim">
            <span>Showing {visibleMembers.length} of {team.members.length} results</span>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="team-rows-per-page">Rows per page</label>
              <select id="team-rows-per-page" className="input h-9 w-[130px] rounded-xl py-1.5 text-xs">
                <option>10 per page</option>
              </select>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim" disabled aria-label="Previous page">&lsaquo;</button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm" aria-current="page">1</button>
              <button type="button" className="grid h-9 w-9 place-items-center rounded-xl border border-line bg-white text-dim" disabled aria-label="Next page">&rsaquo;</button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,4fr)_minmax(280px,1fr)]">
        <form onSubmit={invite} className="card p-5">
          <div className="mb-5 flex items-start gap-4">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
              <MailIcon size={22} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-ink">Invite a teammate</h2>
              <p className="mt-1 text-xs text-dim">Only <span className="mono">@{team.orgDomain || "your-domain"}</span> emails can be invited.</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,1fr)] lg:items-start">
            <div>
              <label className="label">Email</label>
              <input
                id="team-invite-email"
                className="input h-12 rounded-xl"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`name@${team.orgDomain || "example.com"}`}
              />
              {!emailDomainOk && <p className="mt-1 text-xs text-bad">Must be on the @{team.orgDomain} domain.</p>}
            </div>

            <div>
              <label className="label">Role</label>
              <select className="input h-12 rounded-xl" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                {ASSIGNABLE_ROLES.map((assignableRole) => (
                  <option key={assignableRole} value={assignableRole}>{ROLE_LABELS[assignableRole]}</option>
                ))}
              </select>
              <p className="mt-2 text-xs text-faint">{ROLE_DESCRIPTIONS[role]}</p>
            </div>
          </div>

          <button className="btn mt-5 h-12 w-full justify-center rounded-xl sm:w-auto sm:min-w-[180px]" disabled={pending || !emailDomainOk || !email}>
            {pending ? "Working..." : "Send invite"}
          </button>

          {msg && <p className={`mt-3 text-xs ${msg.ok ? "text-ok" : "text-bad"}`}>{msg.text}</p>}
          {inviteLink && (
            <div className="mt-3 rounded-xl border border-line bg-canvas p-3">
              <p className="mb-2 text-xs text-dim">Share this link (no email is sent):</p>
              <div className="flex items-center gap-2">
                <input readOnly value={inviteLink} className="input h-10 flex-1 py-0 text-xs" />
                <button type="button" className="btn-ghost btn-sm h-10 rounded-xl" onClick={() => navigator.clipboard?.writeText(inviteLink)}>Copy</button>
              </div>
            </div>
          )}
        </form>

        <div className="card flex h-full min-h-[220px] flex-col justify-between p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-ok/10 text-ok">
                <ShieldCheckIcon size={22} className="text-ok" />
              </div>
              <div className="max-w-[240px]">
                <h3 className="text-sm font-semibold text-ink">Auto-join by domain</h3>
                <p className="mt-1 text-sm text-dim">Let anyone with a verified <span className="mono">@{team.orgDomain}</span> email join automatically.</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={team.autoJoin}
              disabled={pending}
              onClick={() => act(() => setAutoJoinAction(!team.autoJoin))}
              className={`relative mt-1 h-7 w-12 shrink-0 rounded-full transition-colors ${team.autoJoin ? "bg-primary" : "bg-line"}`}
            >
              <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${team.autoJoin ? "left-[22px]" : "left-0.5"}`} />
            </button>
          </div>
          <div className="mt-6">
            {team.autoJoin ? <p className="text-xs leading-5 text-warn">Anyone who obtains an @{team.orgDomain} email can join. Keep this off unless your domain is tightly controlled.</p> : <p className="text-xs leading-5 text-faint">Recommended for tightly controlled company domains where new teammates should be able to enter without a manual invite.</p>}
          </div>
        </div>
      </div>

      {team.invites.length > 0 && (
        <section className="card overflow-hidden p-0">
          <div className="border-b border-line px-6 py-4">
            <h3 className="text-sm font-semibold text-ink">Pending invites ({team.invites.length})</h3>
          </div>
          <div className="divide-y divide-line">
            {team.invites.map((inviteItem) => (
              <div key={inviteItem.id} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="mono truncate text-sm text-ink">{inviteItem.email}</div>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <RoleBadge role={inviteItem.role} />
                    <button
                      className="text-xs text-primary hover:underline"
                      onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/invite/${inviteItem.token}`)}
                    >
                      Copy invite link
                    </button>
                  </div>
                </div>
                <button className="btn-ghost btn-sm h-10 rounded-xl self-start sm:self-auto" disabled={pending} onClick={() => act(() => revokeInviteAction(inviteItem.id))}>Revoke</button>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
