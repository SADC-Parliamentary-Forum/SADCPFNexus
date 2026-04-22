"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { bcreApi, type BalanceRegister } from "@/lib/api";
import { formatDate } from "@/lib/utils";

function getListData<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as T[];
  }
  return [];
}

function getLastPage(payload: unknown): number {
  if (payload && typeof payload === "object" && "last_page" in payload) {
    const n = Number((payload as { last_page?: unknown }).last_page);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 1;
}

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "Salary Advance",
  imprest:        "Imprest",
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active:   { label: "Active",   badge: "badge-success" },
  closed:   { label: "Closed",   badge: "badge-muted" },
  disputed: { label: "Disputed", badge: "badge-danger" },
  locked:   { label: "Locked",   badge: "badge-warning" },
};

export default function RegistersPage() {
  const searchParams = useSearchParams();
  const [registers, setRegisters]   = useState<BalanceRegister[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [page, setPage]             = useState(1);
  const [lastPage, setLastPage]     = useState(1);
  const [moduleFilter, setModuleFilter] = useState(searchParams.get("module_type") ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (pg = 1, mod = moduleFilter, st = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 20, page: pg };
      if (mod !== "all") params.module_type = mod;
      if (st !== "all") params.status = st;
      const res = await bcreApi.list(params);
      setRegisters(getListData<BalanceRegister>(res.data));
      setLastPage(getLastPage(res.data));
    } catch {
      setError("Failed to load registers.");
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, statusFilter]);

  useEffect(() => { load(1, moduleFilter, statusFilter); }, [moduleFilter, statusFilter]);

  const handlePage = (p: number) => {
    setPage(p);
    load(p, moduleFilter, statusFilter);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Balance Registers</h1>
          <p className="page-subtitle">All controlled balance registers across modules</p>
        </div>
      </div>

      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1">
        <Link href="/finance" className="hover:text-primary">Finance</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/finance/balance-register" className="hover:text-primary">Balance Register</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">All Registers</span>
      </nav>

      {/* Module filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All Modules" },
          { key: "salary_advance", label: "Salary Advance" },
          { key: "imprest", label: "Imprest" },
        ].map(f => (
          <button key={f.key} onClick={() => { setModuleFilter(f.key); setPage(1); }}
            className={`filter-tab${moduleFilter === f.key ? " active" : ""}`}>
            {f.label}
          </button>
        ))}
        <div className="border-l border-neutral-200 mx-1" />
        {[
          { key: "all", label: "All Status" },
          { key: "active", label: "Active" },
          { key: "closed", label: "Closed" },
          { key: "disputed", label: "Disputed" },
          { key: "locked", label: "Locked" },
        ].map(f => (
          <button key={f.key} onClick={() => { setStatusFilter(f.key); setPage(1); }}
            className={`filter-tab${statusFilter === f.key ? " active" : ""}`}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>
      )}

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Module</th>
              <th>Employee</th>
              <th className="text-right">Approved</th>
              <th className="text-right">Balance</th>
              <th>Status</th>
              <th>Last Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j}><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : registers.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12 text-neutral-400 text-sm">No registers found.</td>
              </tr>
            ) : registers.map(reg => (
              <tr key={reg.id} className="hover:bg-neutral-50">
                <td className="font-mono text-sm font-medium text-neutral-800">{reg.reference_number}</td>
                <td className="text-sm">{MODULE_LABELS[reg.module_type] ?? reg.module_type}</td>
                <td className="text-sm">{reg.employee?.name ?? `#${reg.employee_id}`}</td>
                <td className="text-right text-sm font-medium">
                  {Number(reg.approved_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td className="text-right text-sm font-semibold text-neutral-900">
                  {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </td>
                <td>
                  <span className={`text-xs ${STATUS_CONFIG[reg.status]?.badge ?? "badge-muted"}`}>
                    {STATUS_CONFIG[reg.status]?.label ?? reg.status}
                  </span>
                </td>
                <td className="text-sm text-neutral-500">{formatDate(reg.updated_at)}</td>
                <td>
                  <Link href={`/finance/balance-register/${reg.id}`}
                    className="text-xs text-primary hover:underline font-medium">
                    View
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <button onClick={() => handlePage(page - 1)} disabled={page <= 1}
            className="btn-secondary text-sm px-3 py-1 disabled:opacity-40">← Prev</button>
          <span className="text-sm text-neutral-500">Page {page} of {lastPage}</span>
          <button onClick={() => handlePage(page + 1)} disabled={page >= lastPage}
            className="btn-secondary text-sm px-3 py-1 disabled:opacity-40">Next →</button>
        </div>
      )}
    </div>
  );
}
