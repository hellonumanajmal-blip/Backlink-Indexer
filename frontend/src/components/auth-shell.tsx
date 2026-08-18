"use client";

import React from "react";
import Link from "next/link";
import { BrandLockup } from "@/components/brand";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,28rem)] xl:grid-cols-[minmax(0,1fr)_32rem]">
        <aside className="relative hidden border-r border-border bg-surface lg:flex lg:flex-col lg:justify-between">
          <div className="px-10 py-8">
            <BrandLockup />
          </div>
          <div className="px-10 pb-12">
            <p className="max-w-md text-2xl font-semibold tracking-tight text-foreground">
              Evidence for every backlink you submit.
            </p>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted">
              Validate sources, publish legitimate discovery signals, monitor crawls, and review
              index verification — only when the evidence exists.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-muted">
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Accounts are stored in PostgreSQL. Sessions use an httpOnly cookie.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Discovery is not indexing. INDEXED is never guessed.
              </li>
              <li className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                Crawl evidence comes from our own user-agent, not Googlebot spoofing.
              </li>
            </ul>
          </div>
        </aside>

        <main className="flex items-center justify-center px-5 py-12">
          <div className="w-full max-w-sm">
            <div className="mb-8 lg:hidden">
              <BrandLockup compact />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
            <p className="mt-6 text-center text-sm text-muted">{footer}</p>
            <p className="mt-8 text-center text-xs text-muted">
              <Link href="/" className="hover:text-foreground">
                Back to home
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
