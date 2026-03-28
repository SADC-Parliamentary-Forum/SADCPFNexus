"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { AUDIT_ACTION_BADGE, ADMIN_MODULES } from "@/lib/constants";
import { formatDateShort } from "@/lib/utils";

const MODULES = ["All", ...ADMIN_MODULES];
const ACTION_BADGE = AUDIT_ACTION_BADGE;
const ACTIONS = ["All", "created", "updated", "deleted", "approved", "rejected", "submitted", "login", "logout"];
const PAGE_SIZE = 25;

export default function AuditPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState("");
  const [filterModule, setFilterModule] = useState("All");
  const [filterAction, setFilterAction] = useState("All");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    auditApi.list({
      ...(filterUser ? { user: filterUser } : {}),
      ...(filterModule !== "All" ? { module: filterModule } : {}),
      ...(filterAction !== "All" ? { action: filterAction } : {}),
      ...(filterDateFrom ? { date_from: filterDateFrom } : {}),
      ...(filterDateTo ? { date_to: filterDateTo } : {}),
      page,
      per_page: PAGE_SIZE,
    })
      .then((res) => {
        setLogs(res.data.data);
        setLastPage(res.data.last_page);
        setTotal(res.data.total);
      })
      .catch(() => setError("Could not load audit logs. The audit endpoint may not be available yet."))
      .finally(() => setLoading(false));
  }, [filterUser, filterModule, filterAction, filterDateFrom, filterDateTo, page]);

  useEffect(() => { load(); }, [load]);

  const handleFilterChange = (setter: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(e.target.value);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Audit Logs</span>
      </div>

      <div>
        <h1 className="page-title">Audit Logs</h1>
        <p className="page-subtitle">Full activity trail — all user actions with timestamps, module, and IP address.</p>
      </div>

      {/* Filters */}
      <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">User</label>
          <input className="form-input text-xs" placeholder="Filter by user…" value={filterUser} onChange={handleFilterChange(setFilterUser)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Module</label>
          <select className="form-input text-xs" value={filterModule} onChange={handleFilterChange(setFilterModule)}>
            {MODULES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Action Type</label>
          <select className="form-input text-xs" value={filterAction} onChange={handleFilterChange(setFilterAction)}>
            {ACTIONS.map((a) => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Date From</label>
          <input type="date" className="form-input text-xs" value={filterDateFrom} onChange={handleFilterChange(setFilterDateFrom)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-600 mb-1">Date To</label>
          <input type="date" className="form-input text-xs" value={filterDateTo} onChange={handleFilterChange(setFilterDateTo)} />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">warning</span>
          {error}
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="card-header">
          <h2 className="text-sm font-semibold text-neutral-900">Activity Log</h2>
          <span className="text-xs text-neutral-400">{loading ? "Loading…" : `${total} entries`}</span>
        </div>

        {loading ? (
          <div className="space-y-0 divide-y divide-neutral-50">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3 animate-pulse">
                <div className="h-3 w-36 bg-neutral-100 rounded" />
                <div className="h-3 w-28 bg-neutral-100 rounded" />
                <div className="h-5 w-20 bg-neutral-100 rounded-full" />
                <div className="h-3 w-20 bg-neutral-100 rounded ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record ID</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-neutral-400">No audit entries found</td></tr>
                ) : logs.map((l) => (
                  <tr key={l.id}>
                    <td className="text-xs text-neutral-500 whitespace-nowrap">{formatDateShort(l.timestamp)}</td>
                    <td className="text-xs text-neutral-700">{l.user}</td>
                    <td><span className={`badge ${ACTION_BADGE[l.action as keyof typeof ACTION_BADGE] ?? "badge-muted"}`}>{l.action}</span></td>
                    <td className="text-neutral-600">{l.module}</td>
                    <td className="font-mono text-xs text-neutral-500">{l.record_id}</td>
                    <td className="font-mono text-xs text-neutral-400">{l.ip_address ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
            <span className="text-xs text-neutral-400">
              Page {page} of {lastPage} · {total} total
            </span>
            <div className="flex gap-1">
              <button type="button" disabled={page === 1} onClick={() => setPage(p => p - 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(lastPage, 7) }).map((_, i) => {
                const pg = i + 1;
                return (
                  <button key={pg} type="button" onClick={() => setPage(pg)}
                    className={`h-8 w-8 rounded-lg text-xs font-semibold transition-colors ${page === pg ? "bg-primary text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50"}`}>
                    {pg}
                  </button>
                );
              })}
              <button type="button" disabled={page === lastPage} onClick={() => setPage(p => p + 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
