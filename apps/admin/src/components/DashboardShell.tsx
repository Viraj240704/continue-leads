"use client";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import type { Notif } from "@/lib/notifications";
import { Logo } from "./Logo";
import { NotificationBell } from "./NotificationBell";
import { Sidebar, type NavLink } from "./Sidebar";
import { LogOutIcon, MenuIcon, SearchIcon } from "./Icons";

export interface ShellUser {
  name: string;
  roleLabel: string;
  initials: string;
}

export function DashboardShell({
  navItems,
  user,
  notifs,
  children,
}: {
  navItems: NavLink[];
  user: ShellUser;
  notifs: Notif[];
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [q, setQ] = useState("");
  const router = useRouter();
  const pathname = usePathname();

  // Close the mobile drawer whenever navigation lands on a new route.
  useEffect(() => setDrawerOpen(false), [pathname]);

  function search(e: React.FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-ink">
      <header className="sticky top-0 z-30 flex h-16 w-full shrink-0 items-center gap-3 border-b border-line bg-white px-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:px-6">
          <button
            onClick={() => setDrawerOpen(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line text-dim transition hover:bg-raised hover:text-ink md:hidden"
            aria-label="Open navigation menu"
          >
            <MenuIcon size={18} />
          </button>

          <Link href="/home" className="shrink-0" aria-label="ContinueLeads home">
            <Logo />
          </Link>

          <span className="hidden h-6 w-px shrink-0 bg-line md:block" aria-hidden="true" />

          <form
            onSubmit={search}
            className="group absolute left-1/2 hidden w-[260px] -translate-x-1/2 md:block lg:w-[320px] xl:w-[360px]"
          >
            <SearchIcon
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint transition-colors group-focus-within:text-primary"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sites, leads, buyers…"
              aria-label="Search"
              className="h-10 w-full rounded-full border border-transparent bg-raised pl-9 pr-3 text-sm text-ink outline-none transition placeholder:text-faint focus:border-primary focus:bg-white focus:shadow-[0_0_0_4px_rgba(79,70,229,0.12)]"
            />
          </form>

          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
            <NotificationBell items={notifs} />

            <span className="hidden h-6 w-px shrink-0 bg-line sm:block" aria-hidden="true" />

            <div className="flex shrink-0 items-center gap-2.5">
              <div className="hidden text-right leading-tight sm:block">
                <div className="text-sm font-semibold">{user.name}</div>
                <div className="mono text-[10px] font-semibold uppercase tracking-wide text-faint">
                  {user.roleLabel}
                </div>
              </div>
              <div className="relative shrink-0">
                <div className="grid h-9 w-9 place-items-center rounded-full bg-primary text-xs font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.08)]">
                  {user.initials}
                </div>
                <span
                  className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-ok"
                  aria-hidden="true"
                />
              </div>
            </div>

            <span className="hidden h-6 w-px shrink-0 bg-line sm:block" aria-hidden="true" />

            <form action={logoutAction}>
              <button className="btn-ghost btn-sm gap-1.5" aria-label="Sign out">
                <LogOutIcon size={14} />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </header>

      <div className="flex flex-1">
        <Sidebar items={navItems} open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <main className="min-w-0 flex-1 bg-[#F8FAFC] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
