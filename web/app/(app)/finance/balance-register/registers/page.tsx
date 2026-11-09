"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect, useCallback, useMemo, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  active: { label: "finance.bcre.status.active", badge: "badge-success" },
  closed: { label: "finance.bcre.status.closed", badge: "badge-muted" },
  disputed: { label: "finance.bcre.status.disputed", badge: "badge-danger" },
  locked: { label: "finance.bcre.status.locked", badge: "badge-warning" },
};

function RegistersPageContent() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const [registers, setRegisters] = useState<BalanceRegister[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState(searchParams.get("module_type") ?? "all");
  const [statusFilter, setStatusFilter] = useState("all");

  const load = useCallback(async (pg = 1, mod = moduleFilter, st = statusFilter) => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { per_page: 25, page: pg };
      if (mod !== "all") params.module_type = mod;
      if (st !== "all") params.status = st;
      const res = await bcreApi.list(params);
      const rows = getListData<BalanceRegister>(res.data);
      setRegisters(rows);
      setLastPage(getLastPage(res.data));
      setTotal(getTotal(res.data, rows.length));
    } catch {
      setError(t("finance.bcre.registers.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [moduleFilter, statusFilter, t]);

  useEffect(() => {
    void load(1, moduleFilter, statusFilter);
  }, [moduleFilter, statusFilter, load]);

  const handlePage = (p: number) => {
    setPage(p);
    void load(p, moduleFilter, statusFilter);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return registers;
    return registers.filter((reg) => {
      const hay = [
        reg.reference_number,
        MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type,
        reg.employee?.name,
        String(reg.employee_id),
        STATUS_CONFIG[reg.status] ? t(STATUS_CONFIG[reg.status].label) : reg.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [registers, search, t]);

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `balance-registers-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((reg) => ({
        reference: reg.reference_number,
        module: MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type,
        employee: reg.employee?.name ?? `#${reg.employee_id}`,
        approved: reg.approved_amount,
        balance: reg.balance,
        status: STATUS_CONFIG[reg.status] ? t(STATUS_CONFIG[reg.status].label) : reg.status,
        updated_at: reg.updated_at,
      })),
      [
        { key: "reference", header: t("decisions.col.reference") },
        { key: "module", header: t("finance.bcre.col.module") },
        { key: "employee", header: t("finance.payrollImports.col.employee") },
        { key: "approved", header: t("finance.bcre.col.approved") },
        { key: "balance", header: t("finance.bcre.col.balance") },
        { key: "status", header: t("finance.budget.col.status") },
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
        <span className="text-neutral-900 font-medium">{t("finance.bcre.allRegisters")}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <ModulePageHeader
        title="finance.bcre.registers.title"
        subtitle="finance.bcre.registers.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "finance.bcre.registers.title" }]} />}
      />
        <button
          type="button"
          className="btn-secondary text-sm disabled:opacity-50"
          disabled={filtered.length === 0}
          onClick={handleExport}
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t("finance.budget.exportCsv")}
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <div className="relative max-w-md">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder={t("finance.bcre.registers.searchPlaceholder")}
            aria-label={t("finance.bcre.registers.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { key: "all", label: "finance.bcre.registers.allModules" },
            { key: "salary_advance", label: "finance.bcre.module.salary_advance" },
            { key: "imprest", label: "finance.bcre.module.imprest" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setModuleFilter(f.key);
                setPage(1);
              }}
              className={`filter-tab${moduleFilter === f.key ? " active" : ""}`}
            >
              {t(f.label)}
            </button>
          ))}
          <div className="border-l border-neutral-200 mx-1" />
          {[
            { key: "all", label: "finance.bcre.registers.allStatus" },
            { key: "active", label: "finance.bcre.status.active" },
            { key: "closed", label: "finance.bcre.status.closed" },
            { key: "disputed", label: "finance.bcre.status.disputed" },
            { key: "locked", label: "finance.bcre.status.locked" },
          ].map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                setStatusFilter(f.key);
                setPage(1);
              }}
              className={`filter-tab${statusFilter === f.key ? " active" : ""}`}
            >
              {t(f.label)}
            </button>
          ))}
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
              <th className="text-right">{t("finance.bcre.col.approved")}</th>
              <th className="text-right">{t("finance.bcre.col.balance")}</th>
              <th>{t("finance.budget.col.status")}</th>
              <th>{t("finance.bcre.col.lastUpdated")}</th>
              <th><span className="sr-only">{t("finance.budget.col.actions")}</span></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(8)].map((_, i) => (
                <tr key={i}>
                  {[...Array(8)].map((_, j) => (
                    <td key={j}>
                      <div className="h-3 bg-neutral-100 rounded animate-pulse" />
                    </td>
                  ))}
                </tr>
              ))
            ) : filtered.length === 0 ? (
              <TableEmpty colSpan={8} title="finance.bcre.registers.empty" />
            ) : (
              filtered.map((reg) => (
                <tr key={reg.id} className="hover:bg-neutral-50">
                  <td className="font-mono text-sm font-medium text-neutral-800">{reg.reference_number}</td>
                  <td className="text-sm">{MODULE_LABELS[reg.module_type] ? t(MODULE_LABELS[reg.module_type]) : reg.module_type}</td>
                  <td className="text-sm">{reg.employee?.name ?? `#${reg.employee_id}`}</td>
                  <td className="text-right text-sm font-medium">
                    {Number(reg.approved_amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td className="text-right text-sm font-semibold text-neutral-900">
                    {Number(reg.balance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_CONFIG[reg.status]?.badge ?? "badge-muted"}`}>
                      {STATUS_CONFIG[reg.status] ? t(STATUS_CONFIG[reg.status].label) : reg.status}
                    </span>
                  </td>
                  <td className="text-sm text-neutral-500">{formatDate(reg.updated_at)}</td>
                  <td>
                    <Link
                      href={`/finance/balance-register/${reg.id}`}
                      className="btn-secondary text-xs py-1 px-2"
                    >
                      {t("finance.hub.view")}
                    </Link>
                  </td>
                </tr>
              ))
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
      {search.trim() && (
        <p className="text-xs text-neutral-400">
          {t("finance.bcre.registers.searchSummary", { shown: filtered.length, total: registers.length, query: search.trim() })}
        </p>
      )}
    </div>
  );
}

export default function RegistersPage() {
  const { t } = useI18n();
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">{t("common.loading")}</div>}>
      <RegistersPageContent />
    </Suspense>
  );
}
