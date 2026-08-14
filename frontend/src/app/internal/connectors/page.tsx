"use client";

import { useEffect, useState } from "react";

type Connector = {
  id: string;
  name: string;
  connector_type: string;
  state: string;
  schedule_type: string;
  version: string;
};

export default function ConnectorListPage() {
  const [rows, setRows] = useState<Connector[]>([]);
  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/connectors");
      if (res.ok) {
        const data = await res.json();
        setRows(data.items || []);
      }
    };
    load();
    const t = setInterval(load, 4000);
    return () => clearInterval(t);
  }, []);

  async function run(id: string) {
    await fetch("/api/connectors/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connector_id: id }),
    });
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Connector List</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      <table className="w-full text-sm border bg-white">
        <thead>
          <tr className="text-left border-b">
            <th className="p-2">Name</th>
            <th>Type</th>
            <th>State</th>
            <th>Schedule</th>
            <th>Version</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="p-2">
                <a className="underline" href={`/internal/connector-details?id=${c.id}`}>{c.name}</a>
              </td>
              <td>{c.connector_type}</td>
              <td>{c.state}</td>
              <td>{c.schedule_type}</td>
              <td>{c.version}</td>
              <td>
                <button className="border px-2 py-1" onClick={() => run(c.id)}>Run</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
