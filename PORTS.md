# Canonical ports and architecture (source of truth)

This file is the single source of truth for which port each service binds to
locally. If you are about to run this project on a different port "just for
now," stop — update this file instead, or you will recreate the exact port
drift this document exists to prevent.

## Canonical ports

| Service | Port | Command (from repo root) |
|---|---|---|
| FastAPI backend (`freeindexer-backend`) | **8000** | `cd freeindexer-backend; ..\.venv\Scripts\python.exe -m uvicorn app.main:create_app --factory --host 127.0.0.1 --port 8000` |
| Next.js frontend (`frontend`) | **3000** | `cd frontend; npm run dev` (already hardcoded to `-p 3000` in `package.json`) |

No other ports (3005, 3010, 8001, 8041, 8055, etc.) are valid for this
project. Those numbers have shown up in past sessions only as workarounds for
a stale process squatting on 8000/3000 — the fix is to kill the stale
process (see below), not to move to a new port and leave a second `.env`
pointing at it.

## One-time port cleanup

If a port is already taken, find and stop the owner instead of picking a new
port:

```powershell
Get-NetTCPConnection -State Listen | Where-Object { $_.LocalPort -in 3000,8000 } |
  Select-Object LocalPort, OwningProcess
Get-CimInstance Win32_Process -Filter "ProcessId=<pid>" | Select CommandLine
Stop-Process -Id <pid> -Force
```

## Architecture (how a request actually flows)

`frontend/next.config.ts` has **no** `/api/*` rewrite. The only rewrite it
defines is the unrelated `/{indexnow-key}.txt` verification file. This is
deliberate: a `next.config.ts` rewrite is resolved before route handlers, so
an `/api/*` rewrite would silently shadow the handler below and make it dead
code.

`frontend/src/app/api/[...path]/route.ts` is the **only** code path that
handles `/api/*`. It is a catch-all Next.js route handler that:

- translates the dashboard's REST shape (e.g. `/api/backlinks`) into the
  FastAPI backend's shape (e.g. `/api/indexing/backlinks`),
- reshapes/renames fields (`index_status` → `indexed_status`, etc.),
- reaches the backend using `FASTAPI_INTERNAL_URL` (server-side only env var,
  read at request time in `route.ts`).

There is no second path. `API_PROXY_TARGET` has been removed from the code
and from every `.env` file — it used to be able to activate the
`next.config.ts` rewrite above, which would have bypassed `route.ts` and
caused exactly the "two systems disagree" symptom seen in earlier sessions.
If you see `API_PROXY_TARGET` reappear anywhere, that is regression, not a
valid alternative config.

`NEXT_PUBLIC_API_URL` is a **different, unrelated** variable: it's read
client-side (in `src/app/page.tsx`) to pick the origin for the browser's own
`fetch()` calls to this same Next.js app's `/api/*` routes. It is
intentionally left empty so the browser calls relative `/api/...` (same
origin) rather than trying to reach FastAPI directly. Do not set it to the
FastAPI URL — the browser would hit FastAPI's actual route shape
(`/api/indexing/backlinks`, no dashboard field translation) and mostly 404.

## Env files (one source of truth per variable)

- `frontend/.env` — the only frontend env file. `frontend/.env.local` has
  been deleted because it silently overrode `FASTAPI_INTERNAL_URL` to a
  stale port (8055); Next.js loads `.env.local` with higher priority than
  `.env`, which is exactly how that drift happened.
- `freeindexer-backend/.env` — the only backend env file. Not committed to
  git (see `.gitignore`); `.env.example` in the same directory documents
  every key.
- `INDEXNOW_KEY` (frontend) and `FI_INDEXNOW_KEY` (backend) **must be the
  same value**. If they drift apart, IndexNow will reject every submission
  because the `/{key}.txt` file the frontend serves won't match the key the
  backend submits.

## Databases

The backend defaults to SQLite at `freeindexer-backend/freeindexer.db`
(relative to the backend process's working directory — this is why the
backend must be launched with `freeindexer-backend` as its cwd, not the repo
root). `freeindexer-backend/live.db` is a leftover scratch database from a
past verification run against throwaway ports (3010/8041); it is not read by
the canonical setup above and can be deleted.
