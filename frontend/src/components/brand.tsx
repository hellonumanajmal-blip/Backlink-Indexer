import Link from "next/link";
import { Link2 } from "lucide-react";
import { cn } from "@/components/ui";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-primary",
        className
      )}
      aria-hidden="true"
    >
      <Link2 className="h-4 w-4" />
    </span>
  );
}

export function BrandLockup({ href = "/", compact = false }: { href?: string; compact?: boolean }) {
  return (
    <Link href={href} className="inline-flex items-center gap-2.5">
      <BrandMark />
      <span className="leading-tight">
        <span className="block text-sm font-semibold tracking-tight text-foreground">Backlink Indexer</span>
        {compact ? null : (
          <span className="block text-[11px] text-muted">Discovery &amp; verification</span>
        )}
      </span>
    </Link>
  );
}
