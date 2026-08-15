"use client";

import React, { useEffect, useState } from "react";
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
  BarChart3,
  User,
  KeyRound,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/components/ui";
import { hasSession, me, setSession } from '@/lib/dashboard';

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/dashboard/discovery", label: "Discovery Engine", icon: Zap },
  { href: "/dashboard/crawl-monitoring", label: "Crawl Monitoring", icon: Radar },
  { href: "/dashboard/index-verification", label: "Index Verification", icon: Eye },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: LineChart },
  { href: "/dashboard/experiments", label: "Experiments", icon: FlaskConical },
  { href: "/internal/analytics", label: "Analytics", icon: BarChart3 },
];

const SETTINGS_NAV = [
  { href: "/dashboard/settings#account", label: "Account", icon: User },
  { href: "/dashboard/settings#api", label: "API", icon: KeyRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Overview", description: "Here's what's happening with your backlink portfolio." },
  "/dashboard/backlinks": { title: "Backlinks", description: "Manage, import, and monitor your backlinks." },
  "/dashboard/discovery": { title: "Discovery Engine", description: "Legitimate discovery signals for every submitted URL." },
  "/dashboard/crawl-monitoring": { title: "Crawl Monitoring", description: "Crawl evidence, HTTP status, robots, and redirects." },
  "/dashboard/index-verification": { title: "Index Verification", description: "Indexing status from real verification evidence only." },
  "/dashboard/intelligence": { title: "Intelligence", description: "Descriptive insights from observed operational data." },
  "/dashboard/experiments": { title: "Experiments", description: "Compare discovery strategies with real evidence." },
  "/dashboard/settings": { title: "Settings", description: "Account, API keys, and preferences." },
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
  const base = href.includes("#");
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-gradient-to-r from-indigo-500/20 to-violet-500/10 text-white"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-100",
        base && "scroll-mt-20"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarContent({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-white/10 px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-[0_0_16px_rgba(99,102,241,0.4)]">
          <Link2 className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-bold text-white">Backlink Indexing Engine</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-indigo-300/80">Dashboard</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Dashboard">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Monitor</p>
          {NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href))}
              onClick={onNavigate}
            />
          ))}
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Settings</p>
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={pathname === "/dashboard/settings" && item.href === "/dashboard/settings"}
              onClick={onNavigate}
            />
          ))}
        </div>
      </nav>
      <div className="border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-xs font-bold text-white">
            A
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">Admin</p>
            <p className="truncate text-xs text-slate-500">Signed in via existing auth</p>
          </div>
          <button
            aria-label="Log out"
            title="Log out"
            className="rounded-md p-2 text-slate-400 transition hover:bg-white/5 hover:text-white"
            onClick={() => {
              setSession(false);
              router.push("/");
            }}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || "/dashboard";
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Gate on the existing proxy auth. The dashboard requires a session.
    if (!hasSession()) {
      router.replace("/login");
      return;
    }
    void me().catch(() => undefined);
    setReady(true);
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  if (!ready) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-[#060714]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  const meta = TITLES[pathname] || { title: "Dashboard", description: "" };
  const showTopBar = !["/dashboard/settings"].includes(pathname);

  return (
    <div className="dark min-h-screen bg-[#060714] text-foreground">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-white/10 bg-[#080a17]/90 backdrop-blur lg:block">
          <SidebarContent pathname={pathname} />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
            <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="animate-scale-in absolute inset-y-0 left-0 w-72 border-r border-white/10 bg-[#080a17]">
              <button
                aria-label="Close menu"
                className="absolute right-3 top-4 rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        ) : null}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-white/10 bg-[#060714]/80 px-5 backdrop-blur-xl">
            <button
              aria-label="Open menu"
              className="rounded-md p-2 text-slate-300 hover:bg-white/5 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-bold text-white">{meta.title}</h1>
              {showTopBar ? <p className="hidden truncate text-xs text-slate-500 sm:block">{meta.description}</p> : null}
            </div>
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-md border border-white/10 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-white/25 hover:text-white sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View site
            </Link>
          </header>

          <main className="flex-1 px-5 py-6 sm:px-8">{children}</main>

          <footer className="border-t border-white/5 px-5 py-4 sm:px-8">
            <p className="text-xs text-slate-600">
              Indexing decisions are controlled by search engines. This platform provides discovery
              optimization and evidence-based monitoring.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
