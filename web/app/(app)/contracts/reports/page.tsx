"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { contractsApi, type ContractExceptionRecord } from "@/lib/api";
import {
  EXCEPTION_SEVERITIES,
  REGISTER_STATUSES,
  REPORT_TABS,
  badgeClass,
  columnLabelKey,
  contractHref,
  isBadgeColumn,
  isBooleanColumn,
  isDateColumn,
  isMoneyColumn,
  isNumericColumn,
  isReportType,
  nextReportTab,
  reportColumns,
  rowMatchesQuery,
  type ReportTabId,
  type ReportType,
} from "@/lib/contract-reports";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type ExceptionRow = ContractExceptionRecord & {
  contract?: { id: number; reference_number: string; title: string };
};

function displayBoolean(value: unknown, yes: string, no: string): string {
  return value ? yes : no;
}

function displayCell(
  column: string,
  value: unknown,
  row: Record<string, unknown>,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  if (isBooleanColumn(column)) {
    return displayBoolean(value, t("contracts.reports.yes"), t("contracts.reports.no"));
  }
  if (value == null || value === "") {
    return "—";
  }
  if (isMoneyColumn(column)) {
    const amount = Number(value);
    if (Number.isNaN(amount)) return String(value);
    const currency = typeof row.currency === "string" && row.currency ? row.currency : "NAD";
    return formatCurrency(amount, currency);
  }
  if (isDateColumn(column)) {
    return formatDateShort(String(value));
  }
  if (isNumericColumn(column)) {
    return String(value);
  }
  return String(value);
}

export default function ContractReportsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<ReportTabId>("register");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<(typeof REGISTER_STATUSES)[number]>("all");
  const [severity, setSeverity] = useState<(typeof EXCEPTION_SEVERITIES)[number]>("all");

  const reportType: ReportType = isReportType(tab) ? tab : "register";
  const showExceptions = tab === "exceptions";

  const reportQuery = useQuery({
    queryKey: ["contract-report", reportType, status],
    queryFn: () =>
      contractsApi
        .report(reportType, reportType === "register" && status !== "all" ? { status } : undefined)
        .then((r) => r.data),
    enabled: !showExceptions,
  });

  const exceptionQuery = useQuery({
    queryKey: ["contract-exceptions-register", severity],
    queryFn: () =>
      contractsApi
        .exceptionRegister(severity === "all" ? undefined : { severity })
        .then((r) => r.data.data),
    enabled: showExceptions,
  });

  const rows = reportQuery.data?.data ?? [];
  const filteredRows = useMemo(
    () => rows.filter((row) => rowMatchesQuery(row, search)),
    [rows, search],
  );
  const columns = reportColumns(filteredRows.length > 0 ? filteredRows : rows);

  const exceptions = exceptionQuery.data ?? [];
  const filteredExceptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return exceptions;
    return exceptions.filter((row) =>
      `${row.contract?.reference_number ?? ""} ${row.contract?.title ?? ""} ${row.type} ${row.title} ${row.status} ${row.severity}`
        .toLowerCase()
        .includes(needle),
    );
  }, [exceptions, search]);

  const activeTab = REPORT_TABS.find((item) => item.id === tab) ?? REPORT_TABS[0];
  const isLoading = showExceptions ? exceptionQuery.isLoading : reportQuery.isLoading;
  const isError = showExceptions ? exceptionQuery.isError : reportQuery.isError;
  const rowCount = showExceptions ? filteredExceptions.length : filteredRows.length;

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      setTab(nextReportTab(tab, event.key === "ArrowRight" ? 1 : -1));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="contracts.reports.title"
        subtitle="contracts.reports.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.contracts", href: "/contracts" },
              { label: "contracts.reports.title" },
            ]}
          />
        }
        actions={
          <>
            <Link href="/contracts/analytics" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>insights</span>
              {t("contracts.reports.analytics")}
            </Link>
            <Link href="/contracts/risk" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>shield</span>
              {t("contracts.reports.risk")}
            </Link>
          </>
        }
      />

      <div
        className="flex flex-wrap gap-2"
        role="tablist"
        aria-label={t("contracts.reports.catalogue")}
        data-testid="contract-reports-tabs"
        onKeyDown={onTabKey}
      >
        {REPORT_TABS.map((item) => {
          const selected = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              id={`contract-report-tab-${item.id}`}
              aria-selected={selected}
              aria-controls="contract-report-panel"
              tabIndex={selected ? 0 : -1}
              data-testid={`contract-reports-${item.id}`}
              onClick={() => setTab(item.id)}
              className={`filter-tab inline-flex min-h-9 items-center gap-1.5 ${selected ? "active" : ""}`}
            >
              <span className="material-symbols-outlined text-[16px]" aria-hidden>{item.icon}</span>
              {t(item.labelKey)}
            </button>
          );
        })}
      </div>

      <section
        id="contract-report-panel"
        role="tabpanel"
        aria-labelledby={`contract-report-tab-${tab}`}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-neutral-900">{t(activeTab.labelKey)}</h2>
            <p className="mt-1 text-sm text-neutral-500">{t(activeTab.hintKey)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {tab === "register" ? (
              <label className="text-xs font-semibold text-neutral-600">
                {t("contracts.reports.status")}
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as (typeof REGISTER_STATUSES)[number])}
                  className="form-input ml-2 min-w-[8rem] text-sm"
                  data-testid="contract-reports-status"
                >
                  {REGISTER_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {t(`contracts.reports.status.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {showExceptions ? (
              <label className="text-xs font-semibold text-neutral-600">
                {t("contracts.reports.severity")}
                <select
                  value={severity}
                  onChange={(event) => setSeverity(event.target.value as (typeof EXCEPTION_SEVERITIES)[number])}
                  className="form-input ml-2 min-w-[8rem] text-sm"
                  data-testid="contract-reports-severity"
                >
                  {EXCEPTION_SEVERITIES.map((value) => (
                    <option key={value} value={value}>
                      {t(`contracts.reports.severity.${value}`)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="sr-only" htmlFor="contract-reports-search">{t("common.search")}</label>
            <input
              id="contract-reports-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("contracts.reports.search")}
              className="form-input max-w-xs text-sm"
              data-testid="contract-reports-search"
            />
            {!showExceptions ? (
              <div className="flex flex-wrap gap-2">
                {([
                  ["csv", "contracts.reports.exportCsv"],
                  ["xlsx", "contracts.reports.exportXlsx"],
                  ["pdf", "contracts.reports.exportPdf"],
                ] as const).map(([format, key]) => (
                  <a
                    key={format}
                    href={contractsApi.reportDownloadUrl(reportType, format)}
                    className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                    data-testid={`contract-reports-export-${format}`}
                  >
                    <span className="material-symbols-outlined text-[16px]" aria-hidden>download</span>
                    {t(key)}
                  </a>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <p className="text-xs font-medium text-neutral-500" data-testid="contract-reports-count">
          {t("common.rows", { count: rowCount })}
        </p>

        {isError ? (
          <ErrorBanner
            message={t("contracts.reports.loadError")}
            onRetry={() => void (showExceptions ? exceptionQuery.refetch() : reportQuery.refetch())}
          />
        ) : isLoading ? (
          <div className="card p-6 animate-pulse space-y-3" data-testid="contract-reports-loading">
            <div className="h-3 w-40 rounded bg-neutral-100" />
            <div className="h-3 w-72 rounded bg-neutral-100" />
            <div className="h-3 w-56 rounded bg-neutral-100" />
          </div>
        ) : showExceptions ? (
          <div className="card min-w-0 overflow-hidden">
            <div className="max-h-[32rem] overflow-auto">
              <table className="data-table" data-testid="contract-reports-table">
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr>
                    <th>{t("contracts.reports.col.severity")}</th>
                    <th>{t("contracts.reports.col.contract")}</th>
                    <th>{t("contracts.reports.col.exception_type")}</th>
                    <th>{t("contracts.reports.col.exception_title")}</th>
                    <th>{t("contracts.reports.col.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredExceptions.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-0">
                        <EmptyState icon="report" title="contracts.reports.emptyExceptions" />
                      </td>
                    </tr>
                  ) : (
                    filteredExceptions.map((row: ExceptionRow) => {
                      const href = contractHref(row.contract?.id);
                      return (
                        <tr key={row.id}>
                          <td>
                            <span className={`badge ${badgeClass("severity", row.severity)}`}>{row.severity}</span>
                          </td>
                          <td className="font-mono text-xs">
                            {href ? (
                              <Link href={href} className="text-primary hover:underline">
                                {row.contract?.reference_number ?? "—"}
                              </Link>
                            ) : (
                              <span className="text-neutral-600">{row.contract?.reference_number ?? "—"}</span>
                            )}
                          </td>
                          <td className="text-sm capitalize">{row.type.replace(/_/g, " ")}</td>
                          <td className="max-w-sm truncate text-sm text-neutral-800">{row.title}</td>
                          <td className="text-sm capitalize">{row.status}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="card">
            <EmptyState icon="description" title="contracts.reports.empty" />
          </div>
        ) : (
          <div className="card min-w-0 overflow-hidden">
            <div className="max-h-[32rem] overflow-auto">
              <table className="data-table" data-testid="contract-reports-table">
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className={`whitespace-nowrap ${isMoneyColumn(column) || isNumericColumn(column) ? "text-right" : ""}`}
                      >
                        {t(columnLabelKey(column))}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const href = contractHref(row.id);
                    return (
                      <tr key={typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : index}>
                        {columns.map((column) => {
                          const value = row[column];
                          const text = displayCell(column, value, row, t);
                          const align = isMoneyColumn(column) || isNumericColumn(column) ? "text-right tabular-nums" : "";
                          if (column === "reference" && href) {
                            return (
                              <td key={column} className="sticky left-0 z-[1] bg-white font-mono text-xs">
                                <Link href={href} className="text-primary hover:underline">{text}</Link>
                              </td>
                            );
                          }
                          if (isBadgeColumn(column)) {
                            return (
                              <td key={column}>
                                <span className={`badge ${badgeClass(column, String(value ?? ""))}`}>{text}</span>
                              </td>
                            );
                          }
                          if (column === "days_to_expiry") {
                            const days = Number(value);
                            const tone = Number.isNaN(days)
                              ? "text-neutral-700"
                              : days < 0
                                ? "text-red-700"
                                : days <= 30
                                  ? "text-amber-800"
                                  : "text-neutral-700";
                            return <td key={column} className={`text-right tabular-nums ${tone}`}>{text}</td>;
                          }
                          return <td key={column} className={`whitespace-nowrap text-sm ${align}`}>{text}</td>;
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
