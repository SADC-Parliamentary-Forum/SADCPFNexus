"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { bcreApi, type BalanceRegister } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { getListData, getLastPage, getTotal } from "@/lib/listPagination";

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "Salary Advance",
  imprest: "Imprest",
};

function exceptionType(reg: BalanceRegister): { label: string; badge: string } {
  if (reg.status === "disputed") {
    return { label: "Disputed", badge: "badge-danger" };
  }
  return { label: "Pending Verification", badge: "badge-warning" };
}

export default function ExceptionsPage() {
  const [registers, setRegisters] = useState<BalanceRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");

  const load = useCallback(async (pg = 1) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bcreApi.exceptions({ per_page: 25, page: pg });
      const rows = getListData<BalanceRegister>(res.data);
      setRegisters(rows);
      setLastPage(getLastPage(res.data));
      setTotal(getTotal(res.data, rows.length));
    } catch {
      setError("Failed to load exceptions.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(1);
  }, [load]);

  const handlePage = (p: number) => {
    setPage(p);
    void load(p);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return registers;
    return registers.filter((reg) => {
      const exc = exceptionType(reg);
      const hay = [
        reg.reference_number,
        MODULE_LABELS[reg.module_type] ?? reg.module_type,
        reg.employee?.name,
        String(reg.employee_id),
        exc.label,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [registers, search]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `balance-exceptions-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((reg) => ({
        reference: reg.reference_number,
        module: MODULE_LABELS[reg.module_type] ?? reg.module_type,
        employee: reg.employee?.name ?? `#${reg.employee_id}`,
        balance: reg.balance,
        exception: exceptionType(reg).label,
        updated_at: reg.updated_at,
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "module", header: "Module" },
        { key: "employee", header: "Employee" },
        { key: "balance", header: "Balance" },
        { key: "exception", header: "Exception Type" },
        { key: "updated_at", header: "Last Updated" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">Finance</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/finance/balance-register" className="hover:text-primary transition-colors">Balance Register</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Exceptions</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="Exceptions Queue"
        subtitle="Disputed registers and stale pending verifications requiring attention"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Exceptions Queue" }]} />}
      />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/finance/balance-register" className="btn-secondary text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm flex items-start gap-3">
        <span className="material-symbols-outlined text-base mt-0.5">info</span>
        <div>
          <p className="font-medium">What appears here</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-xs">
            <li>
              Registers with status <strong>Disputed</strong> — employee raised a concern
            </li>
            <li>
              Registers with transactions pending verification for more than <strong>72 hours</strong>
            </li>
          </ul>
        </div>
      </div>

      <div className="card p-4">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search reference, employee, exception…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
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
                    <td key={j}>
                      <div className="h-3 bg-neutral-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <span className="material-symbols-outlined text-4xl text-green-300 block mb-2">check_circle</span>
                  <p className="text-sm text-neutral-400">
                    {search.trim()
                      ? "No exceptions match your search."
                      : "No exceptions — all registers are in good standing."}
                  </p>
                </td>
              </tr>
            ) : (
              filtered.map((reg) => {
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
                      <span className={`badge ${exc.badge} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-xs">
                          {reg.status === "disputed" ? "warning" : "hourglass_top"}
                        </span>
                        {exc.label}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-500">{formatDate(reg.updated_at)}</td>
                    <td>
                      <Link
                        href={`/finance/balance-register/${reg.id}`}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Resolve
                      </Link>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
        <ListPagination
          page={page}
          lastPage={lastPage}
          total={total}
          onPageChange={handlePage}
          disabled={loading}
        />
      </div>
    </div>
  );
}
