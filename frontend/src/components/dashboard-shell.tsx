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
  User,
  KeyRound,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/components/ui";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/backlinks", label: "Backlinks", icon: Link2 },
  { href: "/dashboard/discovery", label: "Discovery Engine", icon: Zap },
  { href: "/dashboard/crawl-monitoring", label: "Crawl Monitoring", icon: Radar },
  { href: "/dashboard/index-verification", label: "Index Verification", icon: Eye },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: LineChart },
  { href: "/dashboard/experiments", label: "Experiments", icon: FlaskConical },
];

const SETTINGS_NAV = [
  { href: "/dashboard/settings#profile", label: "Profile", icon: User },
  { href: "/dashboard/settings#security", label: "Security", icon: KeyRound },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const TITLES: Record<string, { title: string; description: string }> = {
  "/dashboard": { title: "Overview", description: "Monitor your backlink discovery and indexing workflow." },
  "/dashboard/backlinks": { title: "Backlinks", description: "Manage, import, and monitor your backlinks." },
  "/dashboard/discovery": { title: "Discovery Engine", description: "Legitimate discovery signals for every submitted URL." },
  "/dashboard/crawl-monitoring": { title: "Crawl Monitoring", description: "Crawl evidence, HTTP status, robots, and redirects." },
  "/dashboard/index-verification": { title: "Index Verification", description: "Indexing status from real verification evidence only." },
  "/dashboard/intelligence": { title: "Intelligence", description: "Descriptive insights from observed operational data." },
  "/dashboard/experiments": { title: "Experiments", description: "Compare discovery strategies with real evidence." },
  "/dashboard/settings": { title: "Settings", description: "Profile, security, and account preferences." },
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
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
        active
          ? "bg-surface-2 text-foreground"
          : "text-muted hover:bg-surface-2/60 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      {label}
    </Link>
  );
}

function SidebarContent({
  pathname,
  userName,
  userEmail,
  onLogout,
  onNavigate,
}: {
  pathname: string;
  userName: string;
  userEmail: string;
  onLogout: () => void;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-2.5 border-b border-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2">
          <Link2 className="h-4 w-4 text-primary" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-tight text-foreground">Backlink Indexer</p>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Dashboard</p>
        </div>
      </div>
      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Dashboard">
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Monitor</p>
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
        </div>
        <div className="space-y-1">
          <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">Settings</p>
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
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-md px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-surface-2 text-xs font-semibold text-foreground">
            {(userName || "U").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{userName || "Account"}</p>
            <p className="truncate text-xs text-muted">{userEmail}</p>
          </div>
          <button
            aria-label="Log out"
            title="Log out"
            className="rounded-md p-2 text-muted transition hover:bg-surface-2 hover:text-foreground"
            onClick={onLogout}
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="px-3 pb-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-2 text-xs font-medium text-muted transition hover:border-border-strong hover:text-foreground"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          View public site
        </Link>
      </div>
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
      <div className="dark flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const meta = TITLES[pathname] || { title: "Dashboard", description: "" };
  const showTopBar = !["/dashboard/settings"].includes(pathname);

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen">
        {/* Desktop sidebar */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-surface lg:block">
          <SidebarContent
            pathname={pathname}
            userName={user?.name || ""}
            userEmail={user?.email || ""}
            onLogout={() => void signOut()}
          />
        </aside>

        {/* Mobile drawer */}
        {mobileOpen ? (
          <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true">
            <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <div className="animate-scale-in absolute inset-y-0 left-0 w-72 border-r border-border bg-surface">
              <button
                aria-label="Close menu"
                className="absolute right-3 top-4 rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground"
                onClick={() => setMobileOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
              <SidebarContent
                pathname={pathname}
                userName={user?.name || ""}
                userEmail={user?.email || ""}
                onLogout={() => void signOut()}
                onNavigate={() => setMobileOpen(false)}
              />
            </div>
          </div>
        ) : null}

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-border bg-background/80 px-5 backdrop-blur-xl">
            <button
              aria-label="Open menu"
              className="rounded-md p-2 text-muted hover:bg-surface-2 hover:text-foreground lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{meta.title}</h1>
              {showTopBar ? <p className="hidden truncate text-xs text-muted sm:block">{meta.description}</p> : null}
            </div>
            <Link
              href="/"
              className="hidden items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted transition hover:border-border-strong hover:text-foreground sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View site
            </Link>
          </header>

          <main className="flex-1 px-5 py-6 sm:px-8">{children}</main>

          <footer className="border-t border-border px-5 py-4 sm:px-8">
            <p className="text-xs text-muted">
              Indexing decisions are controlled by search engines. This platform provides discovery
              optimization and evidence-based monitoring.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
