"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
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

function exceptionType(reg: BalanceRegister): { label: string; badge: string } {
  if (reg.status === "disputed") {
    return { label: "Disputed", badge: "badge-danger" };
  }
  return { label: "Pending Verification", badge: "badge-warning" };
}

export default function ExceptionsPage() {
  const [registers, setRegisters] = useState<BalanceRegister[]>([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [page, setPage]           = useState(1);
  const [lastPage, setLastPage]   = useState(1);

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bcreApi.exceptions({ per_page: 20, page: pg });
      setRegisters(getListData<BalanceRegister>(res.data));
      setLastPage(getLastPage(res.data));
    } catch {
      setError("Failed to load exceptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, []);

  const handlePage = (p: number) => {
    setPage(p);
    load(p);
  };

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Exceptions Queue</h1>
          <p className="page-subtitle">Disputed registers and stale pending verifications requiring attention</p>
        </div>
        <Link href="/finance/balance-register" className="btn-secondary text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-base">arrow_back</span>
          Back to Dashboard
        </Link>
      </div>

      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1">
        <Link href="/finance" className="hover:text-primary">Finance</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <Link href="/finance/balance-register" className="hover:text-primary">Balance Register</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">Exceptions</span>
      </nav>

      {/* Info banner */}
      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm flex items-start gap-3">
        <span className="material-symbols-outlined text-base mt-0.5">info</span>
        <div>
          <p className="font-medium">What appears here</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-xs">
            <li>Registers with status <strong>Disputed</strong> — employee raised a concern</li>
            <li>Registers with transactions pending verification for more than <strong>72 hours</strong></li>
          </ul>
        </div>
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
              <th className="text-right">Balance</th>
              <th>Exception Type</th>
              <th>Last Updated</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(6)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => (
                    <td key={j}><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>
                  ))}
                </tr>
              ))
            ) : registers.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <span className="material-symbols-outlined text-4xl text-green-300 block mb-2">check_circle</span>
                  <p className="text-sm text-neutral-400">No exceptions — all registers are in good standing.</p>
                </td>
              </tr>
            ) : registers.map(reg => {
              const exc = exceptionType(reg);
              return (
                <tr key={reg.id} className="hover:bg-neutral-50">
                  <td className="font-mono text-sm font-medium text-neutral-800">{reg.reference_number}</td>
                  <td className="text-sm">{MODULE_LABELS[reg.module_type] ?? reg.module_type}</td>
                  <td className="text-sm">{reg.employee?.name ?? `#${reg.employee_id}`}</td>
                  <td className="text-right text-sm font-semibold text-neutral-900">
                    NAD {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`text-xs flex items-center gap-1 w-fit ${exc.badge}`}>
                      <span className="material-symbols-outlined text-xs">
                        {reg.status === "disputed" ? "warning" : "hourglass_top"}
                      </span>
                      {exc.label}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-500">{formatDate(reg.updated_at)}</td>
                  <td>
                    <Link href={`/finance/balance-register/${reg.id}`}
                      className="text-xs text-primary hover:underline font-medium">
                      Resolve →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

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
