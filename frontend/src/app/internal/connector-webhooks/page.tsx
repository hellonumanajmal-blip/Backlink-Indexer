"use client";

import { useEffect, useState } from "react";

type Connector = { id: string; name: string; connector_type: string };

export default function ConnectorWebhooksPage() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  useEffect(() => {
    fetch("/api/connectors").then(async (r) => {
      if (r.ok) setConnectors((await r.json()).items || []);
    });
  }, []);

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Webhook Manager</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      <p className="text-sm text-gray-600">
        Outbound webhook connectors sign payloads with X-PDA-Signature. Secrets are stored encrypted and never shown in logs.
      </p>
      <ul className="space-y-2 text-sm">
        {connectors.filter((c) => c.connector_type === "webhook").map((c) => (
          <li key={c.id} className="border bg-white p-3">{c.name} · {c.id.slice(0, 8)}</li>
        ))}
        {!connectors.some((c) => c.connector_type === "webhook") ? (
          <li className="text-gray-500">No webhook connectors yet. Create one via API POST /api/connectors.</li>
        ) : null}
      </ul>
    </div>
  );
}
