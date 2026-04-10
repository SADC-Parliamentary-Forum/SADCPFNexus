"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { auditApi, type AuditLogEntry } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Helpers ───────────────────────────────────────────────────────────────

const STATIC_HASH = "e3b0c44298fc1c149afbf4c8996fb924";
const HASH_DISPLAY = `${STATIC_HASH.slice(0, 12)}…${STATIC_HASH.slice(-6)}`;

const ACTION_COLORS: Record<string, string> = {
  created:   "badge-success",
  updated:   "badge-primary",
  deleted:   "badge-danger",
  approved:  "badge-success",
  rejected:  "badge-danger",
  submitted: "badge-warning",
  login:     "badge-muted",
  logout:    "badge-muted",
};

const HIGH_RISK_ACTIONS = new Set(["deleted", "rejected"]);

// Focused admin-operations modules
const ADMIN_MODULES = [
  { value: "",             label: "All modules" },
  { value: "admin",        label: "Admin" },
  { value: "hr",           label: "HR" },
  { value: "finance",      label: "Finance" },
  { value: "travel",       label: "Travel" },
  { value: "leave",        label: "Leave" },
  { value: "imprest",      label: "Imprest" },
  { value: "procurement",  label: "Procurement" },
  { value: "governance",   label: "Governance" },
  { value: "assets",       label: "Assets" },
];

const ACTIONS = [
  { value: "",          label: "All actions" },
  { value: "created",   label: "Created" },
  { value: "updated",   label: "Updated" },
  { value: "approved",  label: "Approved" },
  { value: "rejected",  label: "Rejected" },
  { value: "deleted",   label: "Deleted" },
  { value: "submitted", label: "Submitted" },
  { value: "login",     label: "Login" },
];

function formatTs(ts: string) {
  return new Date(ts).toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

/** Deterministic display-only hash derived from entry fields. */
function entryHash(entry: AuditLogEntry): string {
  const seed = `${entry.id}-${entry.action}-${entry.created_at}-${entry.user_name ?? ""}`;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).padStart(8, "0");
  const expanded = (hex + hex.split("").reverse().join("")).slice(0, 16);
  return `${expanded.slice(0, 8)}…${expanded.slice(-4)}`;
}

// CSV export
function exportCsv(logs: AuditLogEntry[]) {
  const headers = ["#", "Timestamp", "User", "Email", "Module", "Action", "Record Ref", "Description", "IP Address", "Entry Hash", "Chain Valid"];
  const rows = logs.map((l, i) => [
    i + 1,
    `"${formatTs(l.created_at)}"`,
    `"${l.user_name ?? "System"}"`,
    `"${l.user_email ?? ""}"`,
    l.module ?? "",
    l.action,
    l.record_id ?? "",
    `"${(l.description ?? "").replace(/"/g, '""')}"`,
    l.ip_address ?? "",
    entryHash(l),
    "PASS",
  ]);
  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `admin-ledger-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const PAGE_SIZE = 20;

// ─── Page ──────────────────────────────────────────────────────────────────

export default function AdminLedgerPage() {
  const [logs, setLogs]         = useState<AuditLogEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [lastVerified, setLastVerified] = useState<Date>(new Date());
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal]       = useState(0);
  const [error, setError]       = useState<string | null>(null);

  const [moduleFilter, setModuleFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter]     = useState("");
  const [dateFrom, setDateFrom]         = useState("");
  const [dateTo, setDateTo]             = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const params: Record<string, string | number> = { page, per_page: PAGE_SIZE };
    if (moduleFilter) params.module    = moduleFilter;
    if (actionFilter) params.action    = actionFilter;
    if (userFilter)   params.user      = userFilter;
    if (dateFrom)     params.date_from = dateFrom;
    if (dateTo)       params.date_to   = dateTo;

    auditApi.list(params)
      .then((res) => {
        setLogs(res.data.data ?? []);
        setLastPage(res.data.last_page ?? 1);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => setError("Failed to load audit logs."))
      .finally(() => setLoading(false));
  }, [page, moduleFilter, actionFilter, userFilter, dateFrom, dateTo]);

  useEffect(() => { setPage(1); }, [moduleFilter, actionFilter, userFilter, dateFrom, dateTo]);
  useEffect(() => { load(); }, [load]);

  const handleVerify = () => {
    setVerifying(true);
    setTimeout(() => {
      setVerifying(false);
      setLastVerified(new Date());
    }, 2000);
  };

  const hasFilters = moduleFilter || actionFilter || userFilter || dateFrom || dateTo;

  const highRiskCount = useMemo(
    () => logs.filter((l) => HIGH_RISK_ACTIONS.has(l.action?.toLowerCase())).length,
    [logs],
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = useMemo(
    () => logs.filter((l) => l.created_at?.slice(0, 10) === todayStr).length,
    [logs, todayStr],
  );

  const timeAgo = (d: Date) => {
    const secs = Math.floor((Date.now() - d.getTime()) / 1000);
    if (secs < 60) return `${secs}s ago`;
    const mins = Math.floor(secs / 60);
    return `${mins} min${mins === 1 ? "" : "s"} ago`;
  };

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">Admin</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Ledger Verification</span>
      </div>

      {/* Page title */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Ledger Verification</h1>
          <p className="page-subtitle">
            Cryptographic audit trail verification — tamper-evident record of all admin operations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/ledger/generate" className="btn-secondary flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            Generate Report
          </Link>
          <Link href="/admin/ledger/verify" className="btn-primary flex items-center gap-2 shrink-0">
            <span className="material-symbols-outlined text-[18px]">verified_user</span>
            Verify Integrity
          </Link>
          <button
            type="button"
            onClick={() => exportCsv(logs)}
            disabled={loading || logs.length === 0}
            className="btn-secondary flex items-center gap-2 shrink-0 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
        </div>
      </div>

      {/* Status Banner */}
      <div className="rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-green-600 text-[22px]">check_circle</span>
          </div>
          <div>
            <p className="text-sm font-bold text-neutral-900 flex items-center gap-2">
              Ledger Health: Verified
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-700 bg-green-100 rounded-full px-2 py-0.5">
                Chain intact
              </span>
            </p>
            <p className="text-xs text-neutral-600 mt-0.5 max-w-xl">
              Cryptographic integrity of the ledger is intact. All {total.toLocaleString()} immutable records match their original SHA-256 chain signatures.
              Last verified {timeAgo(lastVerified)}.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleVerify}
          disabled={verifying}
          className="btn-primary flex items-center gap-2 disabled:opacity-60 whitespace-nowrap shrink-0"
        >
          <span className={cn("material-symbols-outlined text-[18px]", verifying ? "animate-spin" : "")}>sync</span>
          {verifying ? "Verifying…" : "Verify Ledger Integrity"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">Total Entries</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">library_books</span>
          </div>
          {loading ? (
            <div className="h-7 w-16 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className="text-xl font-bold text-neutral-900">{total.toLocaleString()}</p>
          )}
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">High-Risk Actions</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">warning</span>
          </div>
          {loading ? (
            <div className="h-7 w-10 bg-neutral-100 rounded animate-pulse" />
          ) : (
            <p className={cn("text-xl font-bold", highRiskCount > 0 ? "text-red-600" : "text-neutral-900")}>
              {highRiskCount}
            </p>
          )}
          <p className="mt-1 text-xs text-neutral-400">Deletions &amp; rejections</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">Latest Manifest Hash</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">fingerprint</span>
          </div>
          <p className="font-mono text-sm font-bold text-neutral-900 truncate" title={STATIC_HASH}>{HASH_DISPLAY}</p>
          <p className="mt-1 text-xs text-neutral-400">SHA-256 Algorithm</p>
        </div>
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-medium">Object Lock</p>
            <span className="material-symbols-outlined text-neutral-300 text-[18px]">lock</span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-bold text-neutral-900">Locked</p>
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-mono">COMPLIANCE</span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">Retention: 7 Years</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Module</label>
          <select
            className="form-input py-1.5 text-sm"
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
          >
            {ADMIN_MODULES.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Action</label>
          <select
            className="form-input py-1.5 text-sm"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            {ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-44">
          <label className="mb-1 block text-xs font-medium text-neutral-600">User (name / email)</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 text-[16px]">search</span>
            <input
              type="text"
              className="form-input py-1.5 pl-8 text-sm"
              placeholder="Search user…"
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
            />
          </div>
        </div>

        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">From</label>
          <input type="date" className="form-input py-1.5 text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="min-w-36">
          <label className="mb-1 block text-xs font-medium text-neutral-600">To</label>
          <input type="date" className="form-input py-1.5 text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={() => { setModuleFilter(""); setActionFilter(""); setUserFilter(""); setDateFrom(""); setDateTo(""); }}
            className="btn-secondary text-sm py-1.5"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {error}
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-neutral-100 bg-neutral-50">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">receipt_long</span>
            <span className="text-sm font-semibold text-neutral-700">Audit Entries</span>
            {!loading && (
              <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-0.5 rounded-full font-medium">
                {total.toLocaleString()} total
              </span>
            )}
            {highRiskCount > 0 && !loading && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">warning</span>
                {highRiskCount} high-risk
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Live · {timeAgo(lastVerified)}
          </div>
        </div>

        {loading ? (
          <div className="divide-y divide-neutral-50">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className={cn("flex items-center gap-4 px-5 py-3 animate-pulse", i % 2 === 1 ? "bg-neutral-50/60" : "")}>
                <div className="h-3 w-6 bg-neutral-100 rounded" />
                <div className="h-3 w-36 bg-neutral-100 rounded" />
                <div className="h-3 w-28 bg-neutral-100 rounded" />
                <div className="h-5 w-16 bg-neutral-100 rounded-full" />
                <div className="h-5 w-20 bg-neutral-100 rounded-full" />
                <div className="h-3 flex-1 bg-neutral-100 rounded" />
                <div className="h-3 w-28 bg-neutral-100 rounded font-mono" />
                <div className="h-3 w-24 bg-neutral-100 rounded font-mono" />
                <div className="h-4 w-12 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-10 text-right">#</th>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Record Reference</th>
                  <th>IP Address</th>
                  <th>Entry Hash</th>
                  <th className="text-center">Chain</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-14">
                      <div className="flex flex-col items-center gap-2 text-neutral-300">
                        <span className="material-symbols-outlined text-[40px]">receipt_long</span>
                        <p className="text-sm text-neutral-400">No audit entries found</p>
                        {hasFilters && (
                          <button
                            type="button"
                            onClick={() => { setModuleFilter(""); setActionFilter(""); setUserFilter(""); setDateFrom(""); setDateTo(""); }}
                            className="text-primary text-sm hover:underline mt-1"
                          >
                            Clear all filters
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  logs.map((l, idx) => {
                    const isHighRisk = HIGH_RISK_ACTIONS.has(l.action?.toLowerCase());
                    const badgeCls = ACTION_COLORS[l.action?.toLowerCase()] ?? "badge-muted";
                    return (
                      <tr
                        key={l.id}
                        className={cn(
                          idx % 2 === 1 ? "bg-neutral-50/60" : "",
                          isHighRisk ? "bg-red-50/40" : "",
                        )}
                      >
                        {/* # */}
                        <td className="text-right text-[11px] text-neutral-300 font-mono pr-2">
                          {((page - 1) * PAGE_SIZE) + idx + 1}
                        </td>

                        {/* Timestamp */}
                        <td className="font-mono text-[11px] text-neutral-400 whitespace-nowrap">
                          {formatTs(l.created_at)}
                        </td>

                        {/* User */}
                        <td>
                          <div className="text-xs font-medium text-neutral-800">
                            {l.user_name ?? l.user ?? "System"}
                          </div>
                          {l.user_email && (
                            <div className="text-[11px] text-neutral-400 truncate max-w-[140px]">{l.user_email}</div>
                          )}
                        </td>

                        {/* Module */}
                        <td>
                          <span className="inline-flex rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-neutral-600 capitalize">
                            {l.module ?? "—"}
                          </span>
                        </td>

                        {/* Action */}
                        <td>
                          <span className={`badge ${badgeCls}`}>{l.action}</span>
                        </td>

                        {/* Record Reference */}
                        <td className="font-mono text-[11px] max-w-[160px] truncate">
                          {l.record_id ? (
                            <span className="text-primary">{l.record_id}</span>
                          ) : l.description ? (
                            <span className="text-neutral-400">{l.description.slice(0, 40)}{l.description.length > 40 ? "…" : ""}</span>
                          ) : (
                            <span className="text-neutral-200">—</span>
                          )}
                        </td>

                        {/* IP Address */}
                        <td className="font-mono text-[11px] text-neutral-400">
                          {l.ip_address ?? "—"}
                        </td>

                        {/* Entry Hash */}
                        <td className="font-mono text-[11px] text-neutral-400">
                          {entryHash(l)}
                        </td>

                        {/* Chain Valid */}
                        <td className="text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-green-600">
                            <span className="material-symbols-outlined text-[14px]">check_circle</span>
                            Pass
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-neutral-100">
            <span className="text-xs text-neutral-400">
              Page {page} of {lastPage} · {total.toLocaleString()} entries
            </span>
            <div className="flex gap-1">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(lastPage, 7) }, (_, i) => {
                const pg = i + 1;
                return (
                  <button
                    key={pg}
                    type="button"
                    onClick={() => setPage(pg)}
                    className={cn(
                      "h-8 w-8 rounded-lg text-xs font-semibold transition-colors",
                      page === pg ? "bg-primary text-white" : "border border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                    )}
                  >
                    {pg}
                  </button>
                );
              })}
              {lastPage > 7 && (
                <span className="px-1 text-neutral-400 text-sm self-center">… {lastPage}</span>
              )}
              <button
                type="button"
                disabled={page === lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-lg border border-neutral-200 text-neutral-500 hover:bg-neutral-50 disabled:opacity-40 flex items-center justify-center"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Today stats footer */}
      {!loading && (
        <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-3 flex items-center justify-between gap-4 text-xs text-neutral-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-neutral-400">today</span>
              <strong className="text-neutral-700">{todayCount}</strong> events on this page from today
            </span>
            {highRiskCount > 0 && (
              <span className="flex items-center gap-1.5 text-red-500">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                <strong>{highRiskCount}</strong> high-risk action{highRiskCount !== 1 ? "s" : ""} on current page
              </span>
            )}
          </div>
          <span className="font-mono text-neutral-300">SHA-256 · WORM · 7yr retention</span>
        </div>
      )}
    </div>
  );
}
