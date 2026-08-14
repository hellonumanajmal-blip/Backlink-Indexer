/**
 * Persistent ping logging for IndexNow submissions made from the Next.js app.
 *
 * Every IndexNow attempt (success, failure, timeout, or skipped because no key
 * is configured) is recorded as one row in the `ping_logs` table. That table
 * is defined by the FastAPI backend (freeindexer-backend, Alembic migration
 * 0019_indexing_dispatch, SQLAlchemy model PingLog) and lives in its SQLite
 * database, so backend dispatch pings and frontend pings share one audit
 * trail. Status vocabulary mirrors app/modules/indexing/constants.py
 * ("success" / "failed" / "skipped").
 *
 * Uses Node's built-in `node:sqlite` — no extra dependency. Logging is
 * strictly best-effort: a logging failure must never break the ping or the
 * request that triggered it, so every entry point swallows errors after a
 * console warning.
 */

import path from "node:path";

export type PingStatus = "success" | "failed" | "skipped";

export interface PingLogEntry {
  /** URLs submitted in this single IndexNow call. */
  urls: string[];
  status: PingStatus;
  /** HTTP status returned by the IndexNow endpoint; null for network/timeout errors or skips. */
  responseCode?: number | null;
  /** Raw response body; for network/timeout errors the error message goes here. */
  responseBody?: string | null;
  /** Error message when the attempt failed. */
  error?: string | null;
  /** Endpoint the ping was sent to. */
  endpoint?: string | null;
  /** Total attempts made (including retries). */
  attempt?: number;
  durationMs?: number;
  /** Backlink ids this ping belongs to (linked when they exist in the backend DB). */
  backlinkIds?: string[];
  /** Outbound request payload; the caller must redact the key first. */
  requestPayload?: Record<string, unknown>;
}

type SqliteDatabase = InstanceType<typeof import("node:sqlite").DatabaseSync>;

let cachedDb: SqliteDatabase | null = null;

/**
 * The backend's SQLite file, resolved relative to the frontend's working
 * directory (`frontend/` in dev). Override with PING_LOGS_DB_PATH when the
 * apps are deployed apart.
 */
export function resolvePingLogDbPath(): string {
  if (process.env.PING_LOGS_DB_PATH) return process.env.PING_LOGS_DB_PATH;
  return path.resolve(process.cwd(), "..", "freeindexer-backend", "freeindexer.db");
}

async function getDb(): Promise<SqliteDatabase> {
  if (cachedDb) return cachedDb;

  const { DatabaseSync } = await import("node:sqlite");
  const dbPath = resolvePingLogDbPath();

  // FK enforcement stays off (matching the backend's own SQLite usage):
  // rows reference a backlink only when it exists in the backend DB.
  const db = new DatabaseSync(dbPath, { enableForeignKeyConstraints: false });
  db.exec("PRAGMA busy_timeout = 3000");

  if (!tableExists(db, "ping_logs")) {
    // Safety net for environments where the backend migrations never ran
    // (schema copied verbatim from Alembic revision 0019). In the shared dev
    // database this is a no-op because Alembic already created the table.
    db.exec(`
      CREATE TABLE IF NOT EXISTS ping_logs (
        id VARCHAR(36) NOT NULL PRIMARY KEY,
        tenant_id VARCHAR(36) NOT NULL,
        backlink_id VARCHAR(36),
        url VARCHAR(2048) NOT NULL,
        method VARCHAR(40) NOT NULL,
        endpoint VARCHAR(512),
        status VARCHAR(32) NOT NULL,
        response_code INTEGER,
        response_body TEXT,
        error TEXT,
        attempt INTEGER NOT NULL DEFAULT '1',
        duration_ms INTEGER NOT NULL DEFAULT '0',
        external_ref VARCHAR(255),
        request_payload JSON NOT NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL
      );
      CREATE INDEX IF NOT EXISTS ix_ping_logs_tenant_id ON ping_logs (tenant_id);
      CREATE INDEX IF NOT EXISTS ix_ping_logs_backlink_id ON ping_logs (backlink_id);
      CREATE INDEX IF NOT EXISTS ix_ping_logs_method ON ping_logs (method);
      CREATE INDEX IF NOT EXISTS ix_ping_logs_status ON ping_logs (status);
      CREATE INDEX IF NOT EXISTS ix_ping_logs_response_code ON ping_logs (response_code);
    `);
  }

  cachedDb = db;
  return db;
}

function tableExists(db: SqliteDatabase, name: string): boolean {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
  return Boolean(row);
}

/** SQLAlchemy-compatible UTC timestamp: "YYYY-MM-DD HH:MM:SS.ffffff". */
function sqlUtcNow(): string {
  return new Date().toISOString().replace("T", " ").replace("Z", "000");
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  return value.length > max ? `${value.slice(0, max)}…[truncated]` : value;
}

/**
 * Resolve which of the given backlink ids actually exist in the backend's
 * `backlinks` table, so the foreign key only links real rows.
 */
function resolveBacklinkId(db: SqliteDatabase, ids: string[]): string | null {
  if (ids.length === 0) return null;
  try {
    if (!tableExists(db, "backlinks")) return null;
    const placeholders = ids.map(() => "?").join(",");
    const row = db
      .prepare(`SELECT id FROM backlinks WHERE id IN (${placeholders}) LIMIT 1`)
      .get(...ids) as { id?: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Insert one row into ping_logs for one IndexNow call. Never throws.
 */
export async function logPingAttempt(entry: PingLogEntry): Promise<void> {
  try {
    const db = await getDb();
    const { randomUUID } = await import("node:crypto");
    const now = sqlUtcNow();
    const ids = entry.backlinkIds ?? [];

    db.prepare(
      `INSERT INTO ping_logs (
         id, tenant_id, backlink_id, url, method, endpoint, status,
         response_code, response_body, error, attempt, duration_ms,
         external_ref, request_payload, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      randomUUID(),
      process.env.PING_LOGS_TENANT_ID || "dev-tenant",
      resolveBacklinkId(db, ids),
      truncate(entry.urls[0] ?? "", 2048) ?? "",
      "indexnow",
      truncate(entry.endpoint ?? null, 512),
      entry.status,
      entry.responseCode ?? null,
      truncate(entry.responseBody ?? null, 4000),
      truncate(entry.error ?? null, 4000),
      entry.attempt ?? 1,
      Math.round(entry.durationMs ?? 0),
      ids.length > 0 ? truncate(ids.join(","), 255) : null,
      JSON.stringify({
        urlList: entry.urls,
        backlink_ids: ids,
        source: "nextjs",
        ...entry.requestPayload,
      }),
      now,
      now
    );
  } catch (err) {
    console.warn(
      `[PING LOG] Failed to persist ping log (${entry.status}) for ${entry.urls[0] ?? "?"}:`,
      err instanceof Error ? err.message : err
    );
  }
}

/**
 * Read the most recent ping log rows (used by verification tooling).
 */
export async function readRecentPingLogs(limit: number = 10): Promise<Record<string, unknown>[]> {
  try {
    const db = await getDb();
    return db
      .prepare(
        `SELECT id, backlink_id, url, method, endpoint, status, response_code,
                response_body, error, attempt, duration_ms, external_ref, created_at
         FROM ping_logs ORDER BY created_at DESC LIMIT ?`
      )
      .all(Math.max(1, Math.min(limit, 100))) as Record<string, unknown>[];
  } catch (err) {
    console.warn("[PING LOG] Failed to read ping logs:", err instanceof Error ? err.message : err);
    return [];
  }
}
