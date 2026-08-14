"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { iconFor } from "./Icons";

export interface NavLink {
  href: string;
  label: string;
}

// Left navigation, positioned below the 64px header.
// - Desktop (>=1280px): 220px, labels visible.
// - Tablet (768-1279px): 72px icon rail, labels hidden.
// - Mobile (<768px): off-canvas drawer toggled by `open`, with a backdrop.
export function Sidebar({
  items,
  open,
  onClose,
}: {
  items: NavLink[];
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/home"
      ? pathname === "/home"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={`fixed inset-x-0 top-16 bottom-0 z-30 bg-ink/40 transition-opacity md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`fixed left-0 top-16 bottom-0 z-40 flex w-[220px] flex-col border-r border-line bg-white transition-transform duration-200 ease-out md:sticky md:z-auto md:h-[calc(100vh-4rem)] md:w-[72px] md:translate-x-0 xl:w-[220px] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-5 xl:px-4">
          {items.map(({ href, label }) => {
            const Icon = iconFor(href);
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                aria-current={active ? "page" : undefined}
                title={label}
                className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors md:justify-center xl:justify-start ${
                  active
                    ? "bg-[#F3F1FF] text-primary"
                    : "text-dim hover:bg-raised hover:text-ink"
                }`}
              >
                {/* Purple active indicator bar */}
                <span
                  className={`absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary transition-opacity ${
                    active ? "opacity-100" : "opacity-0"
                  }`}
                  aria-hidden="true"
                />
                <Icon
                  size={19}
                  className={`shrink-0 ${active ? "text-primary" : "text-faint group-hover:text-dim"}`}
                />
                <span className="md:hidden xl:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
