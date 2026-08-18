"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link2, Plus, Search, Upload, RefreshCw, Trash2, Eye } from "lucide-react";
import {
  Card,
  Button,
  Input,
  Textarea,
  Select,
  EmptyState,
  TableWrap,
  Th,
  Td,
  Skeleton,
  Pill,
  IndexPill,
  Drawer,
  PageError,
  useToast,
} from "@/components/ui";
import {
  listBacklinks,
  createBacklink,
  bulkImport,
  repingBacklink,
  deleteBacklink,
  Backlink,
} from "@/lib/dashboard";

const PAGE_SIZES = [10, 25, 50, 100];

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

export default function BacklinksPage() {
  const toast = useToast();
  const [items, setItems] = useState<Backlink[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [bulkText, setBulkText] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const [detail, setDetail] = useState<Backlink | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setQ(qInput);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(t);
  }, [qInput]);

  const load = useCallback(async () => {
    const res = await listBacklinks({ q: q || undefined, status: status || undefined, page, pageSize });
    if (res.ok) {
      setItems(res.data.items);
      setTotal(res.data.total);
      setError(null);
    } else {
      setItems([]);
      setTotal(0);
      setError(res.status === 401 ? "Authentication required." : res.error || "Failed to load backlinks");
    }
  }, [q, status, page, pageSize, refreshKey]);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  const sorted = useMemo(() => {
    if (!items) return items;
    return [...items].sort((a, b) => (b.created_at || "").localeCompare(a.created_at || ""));
  }, [items]);

  const pages = Math.max(1, Math.ceil(total / pageSize));

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createBacklink({ url, title: title || undefined });
    setBusy(false);
    if (res.ok) {
      toast.push("success", "Backlink added and queued for dispatch.");
      setShowAdd(false);
      setUrl("");
      setTitle("");
      setRefreshKey((k) => k + 1);
    } else {
      toast.push("error", res.error);
    }
  }

  async function handleBulk(e: React.FormEvent) {
    e.preventDefault();
    const urls = bulkText.split(/\n+/).map((s) => s.trim()).filter(Boolean);
    if (urls.length === 0) return;
    setBusy(true);
    const res = await bulkImport(urls, true);
    setBusy(false);
    if (res.ok) {
      toast.push("success", `${res.data.created || 0} added, ${res.data.skipped || 0} skipped (duplicates).`);
      setShowBulk(false);
      setBulkText("");
      setRefreshKey((k) => k + 1);
    } else {
      toast.push("error", res.error);
    }
  }

  async function handleCsv(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    setBusy(true);
    try {
      const res = await fetch("/api/backlinks/import-csv", { method: "POST", body: form, credentials: "include" });
      const data = await res.json().catch(() => ({}));
      setBusy(false);
      if (res.ok) {
        toast.push("success", `CSV imported: ${data.created || 0} added, ${data.skipped || 0} skipped.`);
        setRefreshKey((k) => k + 1);
      } else {
        toast.push("error", data.detail || data.error || "CSV import failed");
      }
    } catch {
      setBusy(false);
      toast.push("error", "CSV import failed — network error");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleReping(b: Backlink) {
    const res = await repingBacklink(b.id);
    if (res.ok && res.data) {
      toast.push("success", res.data.result?.summary || "Dispatch complete.");
      setRefreshKey((k) => k + 1);
    } else {
      toast.push("error", res.ok ? res.data?.error || "Dispatch failed" : res.error);
    }
  }

  async function handleDelete(b: Backlink) {
    if (!window.confirm(`Delete ${b.url}?`)) return;
    const res = await deleteBacklink(b.id);
    if (res.ok) {
      toast.push("success", "Backlink deleted.");
      setDetail(null);
      setRefreshKey((k) => k + 1);
    } else {
      toast.push("error", res.error);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              placeholder="Search URL or domain…"
              className="w-64 pl-9"
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              aria-label="Search backlinks"
            />
          </div>
          <Select className="w-40" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by index status">
            <option value="">All statuses</option>
            <option value="pending">Pending</option>
            <option value="pinged">Pinged</option>
            <option value="indexed">Indexed</option>
            <option value="not_indexed">Not indexed</option>
            <option value="unknown">Unknown</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsv} />
          <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()} loading={busy}>
            <Upload className="h-4 w-4" /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowBulk(true)}>
            <Plus className="h-4 w-4" /> Bulk
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="h-4 w-4" /> Add URL
          </Button>
        </div>
      </div>

      {error ? (
        <PageError message={error} onRetry={() => { setError(null); setRefreshKey((k) => k + 1); }} />
      ) : items === null ? (
        <Card className="space-y-3 p-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-11 w-full" />
          ))}
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Link2 className="h-8 w-8" />}
            title="No backlinks yet"
            description="Add a source URL to start monitoring discovery and indexing evidence."
            action={
              <Button size="sm" onClick={() => setShowAdd(true)}>
                <Plus className="h-4 w-4" /> Add backlink
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <TableWrap className="border-0">
            <thead>
              <tr>
                <Th>URL</Th>
                <Th>Domain</Th>
                <Th>Index</Th>
                <Th>Dispatch</Th>
                <Th>Method</Th>
                <Th>Created</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {sorted!.map((b) => (
                <tr key={b.id} className="hover:bg-surface-2">
                  <Td className="max-w-[280px]">
                    <p className="truncate text-sm font-medium text-foreground" title={b.url}>{b.title || b.url}</p>
                    {b.title ? <p className="truncate text-xs text-muted">{b.url}</p> : null}
                  </Td>
                  <Td><span className="text-sm text-muted">{b.domain || "—"}</span></Td>
                  <Td><IndexPill status={b.index_status} /></Td>
                  <Td>
                    <Pill tone={b.dispatch_status === "submitted" ? "info" : b.dispatch_status === "failed" ? "danger" : b.dispatch_status === "skipped" ? "warning" : "neutral"}>
                      {b.dispatch_status || "pending"}
                    </Pill>
                  </Td>
                  <Td className="text-xs text-muted">{b.dispatch_method || "—"}</Td>
                  <Td className="text-xs text-muted">{formatWhen(b.created_at)}</Td>
                  <Td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <button type="button" aria-label="View" title="View details" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" onClick={() => setDetail(b)}>
                        <Eye className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Re-dispatch" title="Re-dispatch" className="rounded-md p-1.5 text-muted hover:bg-surface-2 hover:text-foreground" onClick={() => handleReping(b)}>
                        <RefreshCw className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="Delete" title="Delete" className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger" onClick={() => handleDelete(b)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
            <p className="text-xs text-muted">
              {total} backlink{total === 1 ? "" : "s"} — page {page} of {pages}
            </p>
            <div className="flex items-center gap-2">
              <Select className="h-8 w-auto text-xs" value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Rows per page">
                {PAGE_SIZES.map((s) => (
                  <option key={s} value={s}>{s} / page</option>
                ))}
              </Select>
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Drawer open={showAdd} onClose={() => setShowAdd(false)} title="Add backlink">
        <form onSubmit={handleAdd} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="add-url">URL</label>
            <Input id="add-url" required type="url" placeholder="https://example.com/article" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="add-title">Title (optional)</label>
            <Input id="add-title" placeholder="Article title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <Button type="submit" loading={busy} className="w-full">Add &amp; dispatch</Button>
        </form>
      </Drawer>

      <Drawer open={showBulk} onClose={() => setShowBulk(false)} title="Bulk import">
        <form onSubmit={handleBulk} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground" htmlFor="bulk-urls">URLs (one per line)</label>
            <Textarea id="bulk-urls" rows={10} placeholder={"https://example.com/one\nhttps://example.com/two"} value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
          </div>
          <Button type="submit" loading={busy} className="w-full">Import &amp; dispatch</Button>
        </form>
      </Drawer>

      <Drawer open={detail !== null} onClose={() => setDetail(null)} title="Backlink details">
        {detail ? (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted">URL</p>
              <p className="mt-1 break-all text-sm font-medium text-foreground">{detail.url}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Domain</p>
                <p className="mt-1 text-sm text-foreground">{detail.domain || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Source</p>
                <p className="mt-1 text-sm text-foreground">{detail.source || "—"}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Index status</p>
                <div className="mt-1.5"><IndexPill status={detail.index_status} /></div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Dispatch</p>
                <div className="mt-1.5">
                  <Pill tone={detail.dispatch_status === "submitted" ? "info" : "neutral"}>{detail.dispatch_status || "pending"}</Pill>
                </div>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Created</p>
                <p className="mt-1 text-sm text-foreground">{formatWhen(detail.created_at)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wider text-muted">Last dispatched</p>
                <p className="mt-1 text-sm text-foreground">{formatWhen(detail.last_dispatched_at)}</p>
              </div>
            </div>
            {detail.last_error ? (
              <div className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs text-danger">
                Last error: {detail.last_error}
              </div>
            ) : null}
            <div className="flex gap-2 border-t border-border pt-4">
              <Button variant="secondary" size="sm" onClick={() => handleReping(detail)}>
                <RefreshCw className="h-4 w-4" /> Re-dispatch
              </Button>
              <Button variant="danger" size="sm" onClick={() => handleDelete(detail)}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </div>
          </div>
        ) : null}
      </Drawer>
    </div>
  );
}
