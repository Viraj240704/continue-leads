"use client";

import { useEffect, useRef, useState } from "react";
import { logoutAction } from "@/app/actions/auth";
import { ChevronRightIcon, EditIcon, LockIcon, MailIcon, TeamIcon, UserIcon } from "./Icons";

export interface ProfileUser {
  name: string;
  email: string;
  department: string;
  initials: string;
}

type ProfileFieldProps = {
  label: string;
  value: string;
  type?: "text" | "email" | "password";
  icon: React.ComponentType<{ size?: number; className?: string }>;
  editing: boolean;
  onEdit: () => void;
  onChange: (value: string) => void;
};

function ProfileField({ label, value, type = "text", icon: Icon, editing, onEdit, onChange }: ProfileFieldProps) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-4 py-2.5 sm:gap-4 sm:px-6">
      <Icon size={20} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <label className="mb-1 block text-sm font-semibold text-ink">{label}</label>
        <input
          type={type}
          value={value}
          readOnly={!editing}
          onChange={(e) => onChange(e.target.value)}
          className="input h-9 text-sm"
          aria-label={label}
        />
      </div>
      <button
        type="button"
        onClick={onEdit}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--r)] border border-line bg-white text-primary shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-raised"
        aria-label={`Edit ${label}`}
      >
        <EditIcon size={17} />
      </button>
    </div>
  );
}

export function ProfileMenu({ user }: { user: ProfileUser }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [profile, setProfile] = useState(user);
  const [password, setPassword] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function toggleField(field: string) {
    if (field === "password" && editing !== field) setPassword("");
    setEditing((current) => (current === field ? null : field));
  }

  function update(field: keyof ProfileUser, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="relative grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)] transition hover:bg-primary-dark"
        aria-label="Open profile"
        aria-expanded={open}
      >
        {user.initials}
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ok" aria-label="Online" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-40 w-[min(410px,calc(100vw-2rem))] overflow-hidden rounded-[var(--r-lg)] border border-line bg-surface shadow-[0_18px_45px_rgba(16,24,40,0.16)]">
          <div className="bg-primary/[0.05] px-5 py-4 text-center sm:px-6">
            <div className="relative mx-auto mb-2 grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-white shadow-[0_2px_5px_rgba(16,24,40,0.12)]">
              {user.initials}
              <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-ok" aria-hidden="true" />
            </div>
            <div className="text-base font-bold text-ink">{profile.name}</div>
            <div className="mt-0.5 text-xs text-dim">{profile.email}</div>
          </div>

          <div>
            <ProfileField label="Name" value={profile.name} icon={UserIcon} editing={editing === "name"} onEdit={() => toggleField("name")} onChange={(value) => update("name", value)} />
            <ProfileField label="Admin or Department" value={profile.department} icon={TeamIcon} editing={editing === "department"} onEdit={() => toggleField("department")} onChange={(value) => update("department", value)} />
            <ProfileField label="Email" value={profile.email} type="email" icon={MailIcon} editing={editing === "email"} onEdit={() => toggleField("email")} onChange={(value) => update("email", value)} />
            <ProfileField label="Password" value={password || "••••••••••"} type="password" icon={LockIcon} editing={editing === "password"} onEdit={() => toggleField("password")} onChange={setPassword} />
          </div>

          <form action={logoutAction}>
            <button type="submit" className="flex w-full items-center gap-3 border-t border-line px-5 py-3 text-left transition hover:bg-[#fff5f4] sm:px-6">
              <span className="text-bad"><ChevronRightIcon size={23} /></span>
              <span>
                <span className="block text-sm font-semibold text-bad">Logout</span>
                <span className="mt-0.5 block text-xs text-dim">Sign out from your account</span>
              </span>
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
