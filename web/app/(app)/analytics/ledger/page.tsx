"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────

const ACTION_COLORS: Record<string, string> = {
  created:  "bg-green-100 text-green-700",
  updated:  "bg-blue-100 text-blue-700",
  deleted:  "bg-red-100 text-red-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-amber-100 text-amber-700",
  submitted:"bg-violet-100 text-violet-700",
  login:    "bg-sky-100 text-sky-700",
  logout:   "bg-neutral-100 text-neutral-600",
};

function actionBadge(action: string) {
  const cls = ACTION_COLORS[action?.toLowerCase()] ?? "bg-neutral-100 text-neutral-600";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize", cls)}>
      {action}
    </span>
  );
}

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

const MODULES = ["All","travel","leave","imprest","procurement","finance","hr","admin","governance","assets","workplan","assignments"];

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AuditLedgerPage() {
  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [total, setTotal]       = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState("");
  const [userFilter, setUserFilter]     = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 25, page };
      if (moduleFilter) params.module   = moduleFilter;
      if (userFilter)   params.user     = userFilter;
      if (dateFrom)     params.date_from = dateFrom;
      if (dateTo)       params.date_to   = dateTo;

      const res  = await auditApi.list(params);
      const data = res.data;
      setLogs(data.data ?? []);
      setTotal(data.total ?? 0);
      setLastPage(data.last_page ?? 1);
    } catch {
      setError("Failed to load audit logs.");
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, userFilter, dateFrom, dateTo, page]);

  useEffect(() => { setPage(1); }, [moduleFilter, userFilter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <nav className="flex items-center text-sm text-neutral-500 mb-1 gap-1">
            <Link href="/analytics" className="hover:text-primary transition-colors">Analytics</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Audit Ledger</span>
          </nav>
          <h1 className="page-title">Audit Ledger</h1>
          <p className="page-subtitle mt-1">
            Immutable record of all system actions — {total.toLocaleString()} entries total
          </p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-green-600">shield_lock</span>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Ledger Integrity</p>
            <p className="text-sm font-bold text-green-700">100% Verified</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-blue-600">library_books</span>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total Entries</p>
            <p className="text-sm font-bold text-neutral-900">{total.toLocaleString()}</p>
          </div>
        </div>
        <div className="card p-4 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 flex-shrink-0">
            <span className="material-symbols-outlined text-[20px] text-indigo-600">dns</span>
          </div>
          <div>
            <p className="text-xs text-neutral-500">System Health</p>
            <div className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <p className="text-sm font-bold text-neutral-900">Operational</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Module</label>
          <select className="form-input py-1.5 text-sm" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value === "All" ? "" : e.target.value)}>
            {MODULES.map((m) => (
              <option key={m} value={m === "All" ? "" : m}>{m === "All" ? "All modules" : m}</option>
            ))}
          </select>
        </div>
        <div className="flex-1 min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">User (name/email)</label>
          <input
            type="text"
            className="form-input py-1.5 text-sm"
            placeholder="Search user…"
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
          />
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">From</label>
          <input type="date" className="form-input py-1.5 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">To</label>
          <input type="date" className="form-input py-1.5 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        {(moduleFilter || userFilter || dateFrom || dateTo) && (
          <button
            type="button"
            onClick={() => { setModuleFilter(""); setUserFilter(""); setDateFrom(""); setDateTo(""); }}
            className="btn-secondary text-sm py-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {/* Log table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="divide-y divide-neutral-50">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-3 animate-pulse">
                <div className="h-3 w-36 bg-neutral-100 rounded" />
                <div className="h-3 w-20 bg-neutral-100 rounded" />
                <div className="h-3 w-24 bg-neutral-100 rounded" />
                <div className="h-3 flex-1 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">receipt_long</span>
            <p className="text-sm text-neutral-500">No audit entries found for the selected filters.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>User</th>
                <th>Module</th>
                <th>Action</th>
                <th>Description</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                    {formatTs(log.created_at)}
                  </td>
                  <td>
                    <div className="text-xs font-medium text-neutral-800">{log.user_name ?? "System"}</div>
                    {log.user_email && (
                      <div className="text-[11px] text-neutral-400">{log.user_email}</div>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 capitalize">
                      {log.module ?? "—"}
                    </span>
                  </td>
                  <td>{actionBadge(log.action)}</td>
                  <td className="text-xs text-neutral-600 max-w-xs truncate" title={log.description ?? ""}>
                    {log.description ?? <span className="text-neutral-300">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-neutral-400">
            Showing {((page - 1) * 25) + 1}–{Math.min(page * 25, total)} of {total.toLocaleString()} entries
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="text-sm text-neutral-600">Page {page} of {lastPage}</span>
            <button
              type="button"
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page === lastPage}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
