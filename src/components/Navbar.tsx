"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

const baseLinks = [
  { href: "/", label: "Inventory" },
  { href: "/scan", label: "Scan Barcode" },
  { href: "/frames/new", label: "New Frame" },
];

const adminLinks = [{ href: "/admin/users", label: "Team" }];

export function Navbar({
  userEmail,
  userName,
  isAdmin = false,
}: {
  userEmail: string;
  userName?: string;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const links = isAdmin ? [...baseLinks, ...adminLinks] : baseLinks;
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-lg font-semibold text-slate-900">
              Glasses Inventory
            </span>
            {isAdmin ? (
              <span
                title="You're signed in as an admin"
                className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700"
              >
                Admin
              </span>
            ) : null}
          </Link>
          <nav className="hidden gap-1 sm:flex">
            {links.map((l) => {
              const active =
                l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={
                    "rounded-md px-3 py-1.5 text-sm font-medium " +
                    (active
                      ? "bg-brand-50 text-brand-700"
                      : "text-slate-600 hover:bg-slate-100")
                  }
                >
                  {l.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <UserMenu email={userEmail} name={userName} isAdmin={isAdmin} />
      </div>
    </header>
  );
}

function UserMenu({
  email,
  name,
  isAdmin,
}: {
  email: string;
  name?: string;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const initials = getInitials(name, email);
  const displayName = name?.trim() || email.split("@")[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full p-1 text-sm transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span
          aria-hidden
          className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white"
        >
          {initials}
        </span>
        <span className="hidden text-slate-700 sm:block">{displayName}</span>
        <span aria-hidden className="hidden text-xs text-slate-400 sm:block">
          ▾
        </span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-64 origin-top-right rounded-lg bg-white py-1 shadow-lg ring-1 ring-slate-200"
        >
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {displayName}
              </span>
              {isAdmin ? (
                <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                  Admin
                </span>
              ) : null}
            </div>
            <div className="truncate text-xs text-slate-500">{email}</div>
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            role="menuitem"
            className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            View profile
          </Link>
          {isAdmin ? (
            <Link
              href="/admin/users"
              onClick={() => setOpen(false)}
              role="menuitem"
              className="block px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
            >
              Team activity
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/login" });
            }}
            role="menuitem"
            className="block w-full px-4 py-2 text-left text-sm text-red-700 hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

function getInitials(name?: string, email?: string): string {
  const source = (name?.trim() || email?.split("@")[0] || "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s.\-_]+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}
