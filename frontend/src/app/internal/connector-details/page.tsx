"use client";

import { useEffect, useState } from "react";

export default function ConnectorDetailsPage() {
  const [connector, setConnector] = useState<any>(null);
  const [id, setId] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get("id") || "";
    setId(cid);
    if (!cid) return;
    fetch(`/api/connectors/${cid}`).then(async (r) => {
      if (r.ok) setConnector(await r.json());
    });
  }, []);

  if (!id) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-2">Connector Details</h1>
        <p className="text-sm text-gray-600">Open from the connector list, or append ?id=…</p>
        <a className="underline text-sm" href="/internal/connectors">Connector list</a>
      </div>
    );
  }
  if (!connector) return <div className="p-6 text-gray-500">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{connector.name}</h1>
      <a className="text-sm underline" href="/internal/connectors">← List</a>
      <div className="border bg-white p-4 text-sm space-y-1">
        <div>Type: {connector.connector_type}</div>
        <div>State: {connector.state}</div>
        <div>Schedule: {connector.schedule_type}</div>
        <div>Timeout: {connector.timeout_seconds}s · Retries: {connector.max_retries}</div>
        <div>Rate limit: {connector.rate_limit_per_minute}/min</div>
        <pre className="mt-3 text-xs overflow-auto">{connector.config_json || "{}"}</pre>
      </div>
    </div>
  );
}
