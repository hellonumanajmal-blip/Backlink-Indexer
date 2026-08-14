import React from "react";

export type BacklinkStatusType =
  | "pending"
  | "pinged"
  | "indexed"
  | "not_indexed"
  | "unknown"
  | "discovered"
  | "crawled"
  | string;

interface StatusBadgeProps {
  status: BacklinkStatusType;
  className?: string;
  type?: "index" | "dispatch";
  method?: string | null;
}

const METHOD_LABELS: Record<string, string> = {
  indexnow: "IndexNow",
  websub: "WebSub",
  google_indexing: "Google Indexing API",
  indexbolt: "IndexBolt",
  rapid_url_indexer: "Rapid URL Indexer",
};

// Honest, scope-aware text mirroring the backend's DISPATCH_METHOD_SUMMARY. We
// only ever claim a signal was sent — never that Google indexed the page.
const METHOD_DISPATCH_SUMMARY: Record<string, string> = {
  indexnow: "signal sent via IndexNow (Bing/Yandex — not Google)",
  websub: "signal sent via WebSub (Google/Bing feed discovery)",
  google_indexing:
    "signal sent via Google Indexing API (owned domains only; official for JobPosting/BroadcastEvent — misuse can revoke API access, not a domain penalty)",
  indexbolt: "submitted via IndexBolt",
  rapid_url_indexer: "submitted via Rapid URL Indexer",
};

export function formatMethodName(method: string | null | undefined): string {
  if (!method) return "";
  return METHOD_LABELS[method.toLowerCase()] || method;
}

export function formatDispatchSummary(method: string | null | undefined): string {
  if (!method) return "submitted";
  const key = method.toLowerCase();
  return METHOD_DISPATCH_SUMMARY[key] || `submitted via ${formatMethodName(method)}`;
}

export function StatusBadge({ status, className = "", type = "index", method }: StatusBadgeProps) {
  const normalized = (status || "").toLowerCase().trim();

  if (type === "dispatch") {
    let dispatchLabel = normalized || "pending";
    let colorClasses = "bg-gray-100 text-gray-700 border-gray-300";

    if (normalized === "submitted") {
      dispatchLabel = formatDispatchSummary(method);
      colorClasses = "bg-emerald-50 text-emerald-800 border-emerald-300";
    } else if (normalized === "failed") {
      dispatchLabel = "failed";
      colorClasses = "bg-red-100 text-red-800 border-red-300";
    } else if (normalized === "skipped") {
      dispatchLabel = "skipped";
      colorClasses = "bg-amber-100 text-amber-800 border-amber-300";
    } else {
      dispatchLabel = "pending";
      colorClasses = "bg-gray-100 text-gray-700 border-gray-300";
    }

    return (
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${colorClasses} ${className}`}
      >
        {dispatchLabel}
      </span>
    );
  }

  // index_status badge: pending (gray), pinged (blue), indexed (green), not_indexed (red)
  let colorClasses = "bg-gray-100 text-gray-700 border-gray-300"; // pending / default: gray

  if (normalized === "indexed") {
    colorClasses = "bg-emerald-100 text-emerald-800 border-emerald-300"; // indexed: green
  } else if (normalized === "pinged") {
    colorClasses = "bg-blue-100 text-blue-800 border-blue-300"; // pinged: blue
  } else if (
    normalized === "not_indexed" ||
    normalized === "lost" ||
    normalized === "removed" ||
    normalized === "404" ||
    normalized === "noindex" ||
    normalized === "blocked"
  ) {
    colorClasses = "bg-red-100 text-red-800 border-red-300"; // not_indexed: red
  } else if (
    normalized === "pending" ||
    normalized === "discovered" ||
    normalized === "crawled" ||
    normalized === "unknown" ||
    normalized === "verification_pending" ||
    normalized === "waiting_for_crawl"
  ) {
    colorClasses = "bg-gray-100 text-gray-700 border-gray-300"; // pending: gray
  }

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${colorClasses} ${className}`}
    >
      {normalized || "pending"}
    </span>
  );
}

export function DispatchBadge({
  status,
  method,
  className = "",
}: {
  status: string;
  method?: string | null;
  className?: string;
}) {
  return <StatusBadge status={status} type="dispatch" method={method} className={className} />;
}

export function PropertyBadge({
  propertyType,
  className = "",
}: {
  propertyType?: string | null;
  className?: string;
}) {
  const owned = (propertyType || "").toUpperCase() === "OWNED_PROPERTY";
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-wide ${
        owned
          ? "bg-emerald-50 text-emerald-800 border-emerald-300"
          : "bg-slate-100 text-slate-800 border-slate-300"
      } ${className}`}
    >
      {owned ? "OWNED PROPERTY" : "THIRD-PARTY BACKLINK"}
    </span>
  );
}

export function VisibilityBadge({
  status,
  className = "",
}: {
  status?: string | null;
  className?: string;
}) {
  const normalized = (status || "UNKNOWN").toUpperCase();
  // INDEXED is only honest when the backend verification engine set it.
  return <StatusBadge status={normalized.toLowerCase()} type="index" className={className} />;
}

export default StatusBadge;
