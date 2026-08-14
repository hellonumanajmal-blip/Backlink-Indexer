"use client";

export const OPS_NAV = [
  ["/internal/ops-center", "Operations Center"],
  ["/internal/observability", "Observability"],
  ["/internal/ai", "AI Decision Engine"],
  ["/internal/live-dashboard", "Live Dashboard"],
  ["/internal/workers", "Workers"],
  ["/internal/queues", "Queues"],
  ["/internal/pipeline-timeline", "Pipeline Timeline"],
  ["/internal/alerts", "Alerts"],
  ["/internal/incidents", "Incidents"],
  ["/internal/notifications", "Notifications"],
  ["/internal/system-activity", "System Activity"],
] as const;

export function OpsNav() {
  return (
    <nav className="flex flex-wrap gap-2 text-sm mb-4">
      {OPS_NAV.map(([href, label]) => (
        <a key={href} href={href} className="border px-3 py-1.5">
          {label}
        </a>
      ))}
    </nav>
  );
}
