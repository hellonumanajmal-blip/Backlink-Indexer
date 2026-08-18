"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Link2,
  LayoutDashboard,
  Zap,
  Radar,
  Eye,
  LineChart,
  FlaskConical,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/components/ui";
import { BrandMark } from "@/components/brand";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/dashboard/discovery", label: "Discovery", icon: Zap },
  { href: "/dashboard/crawl-monitoring", label: "Crawl monitoring", icon: Radar },
  { href: "/dashboard/index-verification", label: "Index verification", icon: Eye },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: LineChart },
  { href: "/dashboard/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Overview", description: "Submitted backlinks and verification evidence from your account." },
  "/dashboard/backlinks": { title: "Backlinks", description: "Search, filter, and manage submitted source URLs." },
  "/dashboard/discovery": { title: "Discovery", description: "Pipeline jobs and legitimate discovery channels." },
  "/dashboard/crawl-monitoring": { title: "Crawl monitoring", description: "HTTP, robots, canonical, and crawlability evidence." },
  "/dashboard/index-verification": { title: "Index verification", description: "Indexing status from verification evidence only." },
  "/dashboard/intelligence": { title: "Intelligence", description: "Descriptive stats from observed jobs — not predictions." },
  "/dashboard/experiments": { title: "Experiments", description: "Compare discovery strategies using recorded evidence." },
  "/dashboard/settings": { title: "Settings", description: "Account information from the authenticated session." },
};

function NavLink({
  href,
  label,
  icon: Icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ElementType;
  active: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition",
        active
          ? "bg-surface-2 font-medium text-foreground"
          : "text-muted hover:bg-surface-2 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarContent({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-4">
        <BrandMark />
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-foreground">Backlink Indexer</p>
          <p className="text-[11px] text-muted">Workspace</p>
        </div>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4" aria-label="Dashboard">
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.exact ? pathname === item.href : pathname.startsWith(item.href)}
            onClick={onNavigate}
          />
        ))}
      </nav>
    </div>
  );
}

function UserMenu({
  name,
  email,
  onLogout,
}: {
  name: string;
  email: string;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const initial = (name || email || "U").slice(0, 1).toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-2 py-1.5 text-left hover:bg-surface-2"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold">
          {initial}
        </span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-[10rem] truncate text-xs font-medium text-foreground">{name || "Account"}</span>
          <span className="block max-w-[10rem] truncate text-[11px] text-muted">{email}</span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-muted sm:block" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-56 rounded-lg border border-border bg-surface py-1 shadow-md"
        >
          <div className="border-b border-border px-3 py-2 sm:hidden">
            <p className="truncate text-sm font-medium">{name || "Account"}</p>
            <p className="truncate text-xs text-muted">{email}</p>
          </div>
          <Link
            href="/dashboard/settings"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            onClick={() => setOpen(false)}
          >
            <Settings className="h-4 w-4 text-muted" />
            Settings
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-2"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
          >
            <LogOut className="h-4 w-4 text-muted" />
            Log out
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const { user, state, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (state === "unauthenticated") {
      router.replace("/login");
    }
  }, [state, router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (state === "loading" || state === "unauthenticated") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" aria-label="Loading" />
      </div>
    );
  }

  const meta = TITLES[pathname] || { title: "Dashboard", description: "" };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-border bg-surface lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
            <div className="absolute inset-y-0 left-0 w-64 border-r border-border bg-surface">
              <button
                type="button"
                aria-label="Close menu"
                className="absolute right-3 top-4 rounded-md p-1.5 text-muted hover:bg-surface-2"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
            <button
              type="button"
              aria-label="Open menu"
              className="rounded-md p-2 text-muted hover:bg-surface-2 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{meta.title}</h1>
              <p className="hidden truncate text-xs text-muted sm:block">{meta.description}</p>
            </div>
            <UserMenu
              name={user?.name || ""}
              email={user?.email || ""}
              onLogout={() => void signOut()}
            />
          </header>

          <main className="flex-1 px-4 py-6 sm:px-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
