"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X, Loader2 } from "lucide-react";

export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  loading = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
  loading?: boolean;
}) {
  const variants: Record<ButtonVariant, string> = {
    primary:
      "bg-primary text-white hover:bg-primary-strong shadow-[0_8px_24px_-8px_color-mix(in_srgb,var(--primary)_60%,transparent)]",
    secondary: "bg-surface-2 text-foreground border border-border hover:bg-surface-3",
    ghost: "text-foreground hover:bg-surface-2",
    outline: "border border-border-strong text-foreground hover:border-primary hover:text-primary",
    danger: "bg-danger-soft text-danger border border-danger/30 hover:bg-danger/15",
  };
  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {props.children}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

export function Card({
  className = "",
  id,
  children,
}: {
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "rounded-xl border border-border bg-surface/70 backdrop-blur-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Status pill (dark-friendly)                                         */
/* ------------------------------------------------------------------ */

export type PillTone = "neutral" | "success" | "info" | "warning" | "danger" | "violet";

const PILL_TONES: Record<PillTone, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  success: "bg-success-soft text-success border-success/30",
  info: "bg-info-soft text-info border-info/30",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
  violet: "bg-primary-soft text-primary border-primary/30",
};

export function Pill({
  tone = "neutral",
  className = "",
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide",
        PILL_TONES[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

/** Map backend index_status values to a pill tone/label (honest vocabulary). */
export function indexTone(status?: string | null): { tone: PillTone; label: string } {
  const s = (status || "unknown").toLowerCase();
  if (s === "indexed") return { tone: "success", label: "Indexed" };
  if (s === "not_indexed" || s === "lost" || s === "removed" || s === "404" || s === "noindex" || s === "blocked")
    return { tone: "danger", label: "Not Indexed" };
  if (s === "pinged") return { tone: "info", label: "Pinged" };
  if (s === "pending" || s === "discovered") return { tone: "warning", label: "Pending" };
  return { tone: "neutral", label: "Unknown" };
}

/** Map backend pipeline_status values to a pill tone. */
export function pipelineTone(status?: string | null): { tone: PillTone; label: string } {
  const s = (status || "").toUpperCase();
  if (s === "INDEXED") return { tone: "success", label: "Indexed" };
  if (s === "VALIDATED" || s === "BACKLINK_VERIFIED" || s === "CRAWLABILITY_CHECK")
    return { tone: "info", label: s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  if (s === "DISCOVERY_QUEUED" || s === "DISCOVERY_SUBMITTED" || s === "WAITING_FOR_CRAWL")
    return { tone: "violet", label: s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  if (s === "VERIFICATION_PENDING" || s === "RETRY_PENDING") return { tone: "warning", label: s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  if (
    s === "INVALID_URL" ||
    s === "URL_UNREACHABLE" ||
    s === "BACKLINK_NOT_FOUND" ||
    s === "DISCOVERY_FAILED" ||
    s === "VERIFICATION_FAILED" ||
    s === "TIMEOUT" ||
    s === "NOT_INDEXED" ||
    s === "NOINDEX" ||
    s === "ROBOTS_BLOCKED"
  )
    return { tone: "danger", label: s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  if (s === "VALIDATING" || s === "RECEIVED" || s === "BACKLINK_CHECK") return { tone: "warning", label: s.replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
  return { tone: "neutral", label: (s || "unknown").replace(/_/g, " ").toLowerCase().replace(/^./, (c) => c.toUpperCase()) };
}

export function IndexPill({ status }: { status?: string | null }) {
  const { tone, label } = indexTone(status);
  return <Pill tone={tone}>{label}</Pill>;
}

export function PipelinePill({ status }: { status?: string | null }) {
  const { tone, label } = pipelineTone(status);
  return <Pill tone={tone}>{label}</Pill>;
}

/* ------------------------------------------------------------------ */
/* Skeleton                                                            */
/* ------------------------------------------------------------------ */

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function SkeletonCard() {
  return (
    <Card className="space-y-3 p-5">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Empty state                                                         */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = "",
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-14 text-center", className)}>
      {icon ? <div className="mb-1 text-muted">{icon}</div> : null}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description ? <p className="max-w-sm text-sm leading-6 text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stat card                                                           */
/* ------------------------------------------------------------------ */

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  loading = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  tone?: PillTone;
  loading?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-16" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
          )}
          {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
        </div>
        {icon ? (
          <div
            className={cn(
              "rounded-lg border p-2",
              tone === "success" && "border-success/30 bg-success-soft text-success",
              tone === "info" && "border-info/30 bg-info-soft text-info",
              tone === "warning" && "border-warning/30 bg-warning-soft text-warning",
              tone === "danger" && "border-danger/30 bg-danger-soft text-danger",
              tone === "violet" && "border-primary/30 bg-primary-soft text-primary",
              tone === "neutral" && "border-border bg-surface-2 text-muted"
            )}
          >
            {icon}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Section heading                                                     */
/* ------------------------------------------------------------------ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-2xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      {eyebrow ? (
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
      ) : null}
      <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h2>
      {description ? <p className="mt-3 text-sm leading-7 text-muted sm:text-base">{description}</p> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Progress bar                                                        */
/* ------------------------------------------------------------------ */

export function ProgressBar({
  value,
  tone = "violet",
  className = "",
}: {
  value: number;
  tone?: PillTone;
  className?: string;
}) {
  const tones: Record<PillTone, string> = {
    neutral: "bg-muted",
    success: "bg-success",
    info: "bg-info",
    warning: "bg-warning",
    danger: "bg-danger",
    violet: "bg-primary",
  };
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className={cn("h-full rounded-full transition-all", tones[tone])}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inputs                                                              */
/* ------------------------------------------------------------------ */

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-foreground">
      {children}
    </label>
  );
}

export function Input({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
      {...props}
    />
  );
}

export function Textarea({
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-border bg-surface-2 px-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary",
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Toast notifications                                                 */
/* ------------------------------------------------------------------ */

type ToastKind = "success" | "error" | "info";
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

const ToastContext = createContext<{ push: (kind: ToastKind, message: string) => void }>({
  push: () => undefined,
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, kind, message }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ push }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-fade-up pointer-events-auto flex items-start gap-2.5 rounded-lg border border-border bg-surface p-3 shadow-lg"
          >
            {t.kind === "success" && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
            {t.kind === "error" && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />}
            {t.kind === "info" && <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />}
            <p className="flex-1 text-sm leading-5 text-foreground">{t.message}</p>
            <button
              aria-label="Dismiss"
              className="text-muted hover:text-foreground"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Drawer                                                              */
/* ------------------------------------------------------------------ */

export function Drawer({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex justify-end" role="dialog" aria-modal="true">
      <div className="animate-fade-in absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-scale-in relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
          <button aria-label="Close" onClick={onClose} className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Data table wrapper                                                  */
/* ------------------------------------------------------------------ */

export function TableWrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border bg-surface/70", className)}>
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return (
    <th className={cn("border-b border-border bg-surface-2/60 px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted", className)}>
      {children}
    </th>
  );
}

export function Td({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn("border-b border-border px-4 py-3 align-middle", className)}>{children}</td>;
}
