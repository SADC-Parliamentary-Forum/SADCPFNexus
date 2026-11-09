"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { bcreApi, type BalanceRegister } from "@/lib/api";
import { formatDate } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { getListData, getLastPage, getTotal } from "@/lib/listPagination";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MODULE_LABELS: Record<string, string> = {
  salary_advance: "finance.bcre.module.salary_advance",
  imprest: "finance.bcre.module.imprest",
};

function exceptionType(reg: BalanceRegister): { label: string; badge: string } {
  if (reg.status === "disputed") {
    return { label: "finance.bcre.status.disputed", badge: "badge-danger" };
  }
  return { label: "finance.bcre.dashboard.pending", badge: "badge-warning" };
}

export default function ExceptionsPage() {
  const { t } = useI18n();
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
      setError(t("finance.bcre.exceptions.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
        MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type,
        reg.employee?.name,
        String(reg.employee_id),
        t(exc.label),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [registers, search, t]);

  const [disputedBefore, disputedAfter = ""] = t("finance.bcre.exceptions.ruleDisputed").split("{status}");
  const [staleBefore, staleAfter = ""] = t("finance.bcre.exceptions.ruleStale").split("{hours}");

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `balance-exceptions-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((reg) => ({
        reference: reg.reference_number,
        module: MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type,
        employee: reg.employee?.name ?? `#${reg.employee_id}`,
        balance: reg.balance,
        exception: t(exceptionType(reg).label),
        updated_at: reg.updated_at,
      })),
      [
        { key: "reference", header: t("decisions.col.reference") },
        { key: "module", header: t("finance.bcre.col.module") },
        { key: "employee", header: t("finance.payrollImports.col.employee") },
        { key: "balance", header: t("finance.bcre.col.balance") },
        { key: "exception", header: t("finance.bcre.exceptions.col.type") },
        { key: "updated_at", header: t("finance.bcre.col.lastUpdated") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/finance" className="hover:text-primary transition-colors">{t("nav.finance")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/finance/balance-register" className="hover:text-primary transition-colors">{t("finance.bcre.balanceRegister")}</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("finance.bcre.exceptions.crumb")}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="finance.bcre.exceptionsQueue"
        subtitle="finance.bcre.exceptions.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "finance.bcre.exceptionsQueue" }]} />}
      />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("finance.budget.exportCsv")}
          </button>
          <Link href="/finance/balance-register" className="btn-secondary text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-base">arrow_back</span>
            {t("finance.bcre.exceptions.backToDashboard")}
          </Link>
        </div>
      </div>

      <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-700 px-4 py-3 text-sm flex items-start gap-3">
        <span className="material-symbols-outlined text-base mt-0.5">info</span>
        <div>
          <p className="font-medium">{t("finance.bcre.exceptions.whatAppears")}</p>
          <ul className="list-disc ml-4 mt-1 space-y-0.5 text-xs">
            <li>
              {disputedBefore}<strong>{t("finance.bcre.status.disputed")}</strong>{disputedAfter}
            </li>
            <li>
              {staleBefore}<strong>{t("finance.bcre.exceptions.hours72")}</strong>{staleAfter}
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
            placeholder={t("finance.bcre.exceptions.searchPlaceholder")}
            aria-label={t("finance.bcre.exceptions.searchPlaceholder")}
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
              <th>{t("decisions.col.reference")}</th>
              <th>{t("finance.bcre.col.module")}</th>
              <th>{t("finance.payrollImports.col.employee")}</th>
              <th className="text-right">{t("finance.bcre.col.balance")}</th>
              <th>{t("finance.bcre.exceptions.col.type")}</th>
              <th>{t("finance.bcre.col.lastUpdated")}</th>
              <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
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
              <TableEmpty
                colSpan={7}
                icon="check_circle"
                title={
                  search.trim()
                    ? "finance.bcre.exceptions.noMatch"
                    : "finance.bcre.exceptions.empty"
                }
              />
            ) : (
              filtered.map((reg) => {
                const exc = exceptionType(reg);
                return (
                  <tr key={reg.id} className="hover:bg-neutral-50">
                    <td className="font-mono text-sm font-medium text-neutral-800">{reg.reference_number}</td>
                    <td className="text-sm">{MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type}</td>
                    <td className="text-sm">{reg.employee?.name ?? `#${reg.employee_id}`}</td>
                    <td className="text-right text-sm font-semibold text-neutral-900">
                      {"NAD"} {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td>
                      <span className={`badge ${exc.badge} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-xs">
                          {reg.status === "disputed" ? "warning" : "hourglass_top"}
                        </span>
                        {t(exc.label)}
                      </span>
                    </td>
                    <td className="text-sm text-neutral-500">{formatDate(reg.updated_at)}</td>
                    <td>
                      <Link
                        href={`/finance/balance-register/${reg.id}`}
                        className="btn-secondary text-xs py-1 px-2"
                      >
                        {t("finance.bcre.exceptions.resolve")}
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
