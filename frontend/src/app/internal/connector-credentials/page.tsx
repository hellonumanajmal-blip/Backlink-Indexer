"use client";

export default function ConnectorCredentialsPage() {
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Credential Manager</h1>
      <a className="text-sm underline" href="/internal/integrations">← Dashboard</a>
      <p className="text-sm text-gray-600 max-w-2xl">
        API keys, bearer tokens, and webhook secrets are accepted on connector create
        (<code className="mx-1">credential</code>
        and stored encrypted at rest. Plaintext values are never returned by list APIs and are redacted from connector logs.
      </p>
      <div className="border bg-white p-4 text-sm space-y-2">
        <div>Supported auth types: api_key, bearer, webhook_secret, custom headers</div>
        <div>Encryption: Fernet when CONNECTOR_MASTER_KEY / INDEXNOW_MASTER_KEY / SESSION_SECRET is set</div>
        <div>Tenant isolation: credentials scoped by connector and optional project_id</div>
      </div>
    </div>
  );
}
