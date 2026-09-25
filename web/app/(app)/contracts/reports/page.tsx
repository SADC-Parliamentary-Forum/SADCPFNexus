"use client";

import { Suspense, useMemo, useRef, useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner, TableEmpty } from "@/components/ui/EmptyState";
import { PrintButton } from "@/components/ui/PrintButton";
import { contractsApi, type ContractExceptionRecord } from "@/lib/api";
import {
  EXCEPTION_SEVERITIES,
  OPERATIONAL_HORIZONS,
  REGISTER_STATUSES,
  REPORT_TABS,
  badgeClass,
  badgeLabelKey,
  columnLabelKey,
  columnPriority,
  columnVisibilityClass,
  contractHref,
  exceptionTypeLabelKey,
  humanizeToken,
  isBadgeColumn,
  isBooleanColumn,
  isDateColumn,
  isKpiActive,
  isMoneyColumn,
  isNumericColumn,
  isReportType,
  kpiDrilldown,
  matchesOperationalHorizon,
  matchesReportFlag,
  nextReportTab,
  nextSort,
  parseReportFlag,
  parseReportTab,
  reportColumns,
  reportCurrency,
  reportDownloadHref,
  reportKpis,
  rowMatchesQuery,
  sortReportRows,
  type OperationalHorizon,
  type ReportSort,
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

function displayBadge(
  column: string,
  value: unknown,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const raw = String(value ?? "");
  if (!raw) {
    return "—";
  }
  const key = badgeLabelKey(column, raw);
  const label = t(key);
  return label === key ? humanizeToken(raw) : label;
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
  if (isBadgeColumn(column)) {
    return displayBadge(column, value, t);
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

function kpiTone(tone?: "neutral" | "warning" | "danger" | "success"): string {
  if (tone === "danger") return "text-red-700";
  if (tone === "warning") return "text-amber-800";
  if (tone === "success") return "text-green-700";
  return "text-neutral-900";
}

function ContractReportsDesk() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabRefs = useRef<Partial<Record<ReportTabId, HTMLButtonElement | null>>>({});

  const tab = parseReportTab(searchParams.get("type"));
  const status = (REGISTER_STATUSES.includes(searchParams.get("status") as (typeof REGISTER_STATUSES)[number])
    ? searchParams.get("status")
    : "all") as (typeof REGISTER_STATUSES)[number];
  const severity = (EXCEPTION_SEVERITIES.includes(searchParams.get("severity") as (typeof EXCEPTION_SEVERITIES)[number])
    ? searchParams.get("severity")
    : "all") as (typeof EXCEPTION_SEVERITIES)[number];
  const horizon = (OPERATIONAL_HORIZONS.includes(searchParams.get("horizon") as OperationalHorizon)
    ? searchParams.get("horizon")
    : "all") as OperationalHorizon;
  const flag = parseReportFlag(searchParams.get("flag"));
  const search = searchParams.get("q") ?? "";

  const [sort, setSort] = useState<ReportSort | null>(null);

  const reportType: ReportType = isReportType(tab) ? tab : "register";
  const showExceptions = tab === "exceptions";

  const replaceQuery = (mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const setTab = (next: ReportTabId) => {
    setSort(null);
    replaceQuery((params) => {
      if (next === "register") {
        params.delete("type");
      } else {
        params.set("type", next);
      }
      if (next !== "register") {
        params.delete("status");
      }
      if (next !== "exceptions") {
        params.delete("severity");
      }
      if (next !== "operational") {
        params.delete("horizon");
      }
      params.delete("flag");
    });
  };

  const reportQuery = useQuery({
    queryKey: ["contract-report", reportType, status],
    queryFn: () =>
      contractsApi
        .report(reportType, reportType === "register" && status !== "all" ? { status } : undefined)
        .then((r) => r.data),
    enabled: !showExceptions,
  });

  const exceptionQuery = useQuery({
    queryKey: ["contract-exceptions-register"],
    queryFn: () => contractsApi.exceptionRegister().then((r) => r.data.data),
    enabled: showExceptions,
  });

  const extractRows = reportQuery.data?.data ?? [];
  const rows = useMemo(
    () =>
      extractRows.filter((row) => {
        if (tab === "operational" && !matchesOperationalHorizon(row, horizon)) {
          return false;
        }
        return matchesReportFlag(row, flag);
      }),
    [extractRows, flag, horizon, tab],
  );

  const filteredRows = useMemo(
    () => sortReportRows(rows.filter((row) => rowMatchesQuery(row, search)), sort),
    [rows, search, sort],
  );
  const columns = reportColumns(filteredRows.length > 0 ? filteredRows : rows);

  const exceptions = exceptionQuery.data ?? [];
  const scopedExceptions = useMemo(
    () => exceptions.filter((row) => severity === "all" || row.severity === severity),
    [exceptions, severity],
  );
  const filteredExceptions = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const visible = !needle
      ? scopedExceptions
      : scopedExceptions.filter((row) =>
          `${row.contract?.reference_number ?? ""} ${row.contract?.title ?? ""} ${row.type} ${row.title} ${row.status} ${row.severity}`
            .toLowerCase()
            .includes(needle),
        );
    if (!sort) {
      return visible;
    }
    return [...visible].sort((left, right) => {
      const map: Record<string, unknown> = {
        severity: left.severity,
        contract: left.contract?.reference_number,
        exception_type: left.type,
        exception_title: left.title,
        status: left.status,
      };
      const other: Record<string, unknown> = {
        severity: right.severity,
        contract: right.contract?.reference_number,
        exception_type: right.type,
        exception_title: right.title,
        status: right.status,
      };
      const comparison = String(map[sort.column] ?? "").localeCompare(String(other[sort.column] ?? ""), undefined, {
        sensitivity: "base",
      });
      return sort.direction === "desc" ? -comparison : comparison;
    });
  }, [scopedExceptions, search, sort]);

  const activeTab = REPORT_TABS.find((item) => item.id === tab) ?? REPORT_TABS[0];
  const isLoading = showExceptions ? exceptionQuery.isLoading : reportQuery.isLoading;
  const isError = showExceptions ? exceptionQuery.isError : reportQuery.isError;
  const rowCount = showExceptions ? filteredExceptions.length : filteredRows.length;
  const hasSourceRows = showExceptions ? exceptions.length > 0 : extractRows.length > 0;
  const kpis = reportKpis(tab, extractRows, exceptions);
  const currency = reportCurrency(extractRows);
  const generatedAt = formatDateShort(new Date());
  const kpiState = { flag, horizon, severity };

  const setSearch = (value: string) => {
    replaceQuery((params) => {
      if (!value.trim()) {
        params.delete("q");
      } else {
        params.set("q", value);
      }
    });
  };

  const applyKpi = (kpiId: string) => {
    const drill = kpiDrilldown(tab, kpiId);
    if (!drill) {
      return;
    }
    const active = isKpiActive(tab, kpiId, kpiState);
    replaceQuery((params) => {
      if (drill.flag) {
        if (active) {
          params.delete("flag");
        } else {
          params.set("flag", drill.flag);
        }
      }
      if (drill.horizon) {
        if (active) {
          params.delete("horizon");
        } else {
          params.set("horizon", drill.horizon);
        }
      }
      if (drill.severity) {
        if (active) {
          params.delete("severity");
        } else {
          params.set("severity", drill.severity);
        }
      }
    });
  };

  const clearFilters = () => {
    replaceQuery((params) => {
      params.delete("status");
      params.delete("horizon");
      params.delete("severity");
      params.delete("flag");
      params.delete("q");
    });
  };

  const chips = [
    status !== "all" ? { id: "status", label: t(`contracts.reports.status.${status}`) } : null,
    horizon !== "all" ? { id: "horizon", label: t(`contracts.reports.horizon.${horizon}`) } : null,
    severity !== "all" ? { id: "severity", label: t(`contracts.reports.severity.${severity}`) } : null,
    flag ? { id: "flag", label: t(`contracts.reports.flag.${flag}`) } : null,
    search.trim() ? { id: "q", label: search.trim() } : null,
  ].filter((chip): chip is { id: string; label: string } => chip !== null);

  const openContract = (href: string | null, event?: { target?: EventTarget | null }) => {
    if (!href) {
      return;
    }
    if (typeof window !== "undefined" && window.getSelection()?.toString()) {
      return;
    }
    if (event?.target instanceof Element && event.target.closest("a")) {
      return;
    }
    router.push(href);
  };

  const onTabKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      const next = nextReportTab(tab, event.key === "ArrowRight" ? 1 : -1);
      setTab(next);
      requestAnimationFrame(() => tabRefs.current[next]?.focus());
    }
  };

  const exportHref = (format: "csv" | "xlsx" | "pdf") =>
    reportDownloadHref(reportType, format, reportType === "register" && status !== "all" ? { status } : undefined);

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
          <div className="no-print flex flex-wrap items-center gap-2">
            <Link href="/contracts/analytics" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>insights</span>
              {t("contracts.reports.analytics")}
            </Link>
            <Link href="/contracts/risk" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
              <span className="material-symbols-outlined text-[16px]" aria-hidden>shield</span>
              {t("contracts.reports.risk")}
            </Link>
          </div>
        }
      />

      <div
        className="no-print flex flex-wrap gap-2"
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
              ref={(node) => {
                tabRefs.current[item.id] = node;
              }}
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
        className="space-y-4 print-content"
      >
        <div className="min-w-0">
          <div className="hidden print:block border-b border-neutral-200 pb-3 mb-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-neutral-500">
              {t("contracts.reports.orgName")}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-neutral-900">{t(activeTab.labelKey)}</h2>
            <p className="mt-1 text-xs text-neutral-500">
              {t("contracts.reports.generatedAt", { date: generatedAt, count: rowCount })}
            </p>
          </div>
          <h2 className="text-base font-semibold text-neutral-900 print:hidden">{t(activeTab.labelKey)}</h2>
          <p className="mt-1 text-sm text-neutral-500 print:hidden">{t(activeTab.hintKey)}</p>
          <p className="mt-1 text-xs text-neutral-400 print:hidden" data-testid="contract-reports-generated">
            {t("contracts.reports.generatedAt", { date: generatedAt, count: rowCount })}
          </p>
        </div>

        <div
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
          data-testid="contract-reports-kpis"
        >
          {kpis.map((kpi) => {
            const drillable = Boolean(kpiDrilldown(tab, kpi.id));
            const active = isKpiActive(tab, kpi.id, kpiState);
            const body = (
              <>
                <p className={`text-xl font-bold tabular-nums leading-tight ${kpiTone(kpi.tone)}`}>
                  {kpi.money ? (currency ? formatCurrency(kpi.value, currency) : "—") : kpi.value}
                </p>
                <p className="mt-1 text-xs text-neutral-500">{t(kpi.labelKey)}</p>
                {kpi.money && !currency ? (
                  <p className="mt-0.5 text-[11px] text-neutral-400">{t("contracts.reports.mixedCurrency")}</p>
                ) : null}
              </>
            );
            if (!drillable) {
              return (
                <div key={kpi.id} className="card p-4" data-testid={`contract-reports-kpi-${kpi.id}`}>
                  {body}
                </div>
              );
            }
            return (
              <button
                key={kpi.id}
                type="button"
                data-testid={`contract-reports-kpi-${kpi.id}`}
                aria-pressed={active}
                onClick={() => applyKpi(kpi.id)}
                className={`card p-4 text-left transition-colors hover:border-primary/40 ${
                  active ? "ring-2 ring-primary/40 border-primary/40" : ""
                }`}
              >
                {body}
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-neutral-400 print:hidden">{t("contracts.reports.kpiFilterHint")}</p>

        <div className="no-print card p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
            <div className="flex flex-wrap items-end gap-3">
              {tab === "register" ? (
                <label className="block text-xs font-semibold text-neutral-600" htmlFor="contract-reports-status">
                  {t("contracts.reports.status")}
                  <select
                    id="contract-reports-status"
                    value={status}
                    onChange={(event) =>
                      replaceQuery((params) => {
                        if (event.target.value === "all") {
                          params.delete("status");
                        } else {
                          params.set("status", event.target.value);
                        }
                      })
                    }
                    className="form-input mt-1 min-w-[10rem] text-sm"
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
              {tab === "operational" ? (
                <label className="block text-xs font-semibold text-neutral-600" htmlFor="contract-reports-horizon">
                  {t("contracts.reports.horizon")}
                  <select
                    id="contract-reports-horizon"
                    value={horizon}
                    onChange={(event) =>
                      replaceQuery((params) => {
                        if (event.target.value === "all") {
                          params.delete("horizon");
                        } else {
                          params.set("horizon", event.target.value);
                        }
                      })
                    }
                    className="form-input mt-1 min-w-[10rem] text-sm"
                    data-testid="contract-reports-horizon"
                  >
                    {OPERATIONAL_HORIZONS.map((value) => (
                      <option key={value} value={value}>
                        {t(`contracts.reports.horizon.${value}`)}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {showExceptions ? (
                <label className="block text-xs font-semibold text-neutral-600" htmlFor="contract-reports-severity">
                  {t("contracts.reports.severity")}
                  <select
                    id="contract-reports-severity"
                    value={severity}
                    onChange={(event) =>
                      replaceQuery((params) => {
                        if (event.target.value === "all") {
                          params.delete("severity");
                        } else {
                          params.set("severity", event.target.value);
                        }
                      })
                    }
                    className="form-input mt-1 min-w-[10rem] text-sm"
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
              <div className="min-w-[14rem] flex-1">
                <label className="block text-xs font-semibold text-neutral-600" htmlFor="contract-reports-search">
                  {t("common.search")}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id="contract-reports-search"
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder={t("contracts.reports.search")}
                    className="form-input text-sm"
                    data-testid="contract-reports-search"
                  />
                  {search ? (
                    <button
                      type="button"
                      className="btn-secondary text-sm"
                      onClick={() => setSearch("")}
                      data-testid="contract-reports-clear-search"
                    >
                      {t("contracts.reports.clearSearch")}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span data-testid="contract-reports-print">
                <PrintButton label={t("contracts.reports.print")} className="text-sm" />
              </span>
              {!showExceptions ? (
                <>
                  {([
                    ["csv", "contracts.reports.exportCsv"],
                    ["xlsx", "contracts.reports.exportXlsx"],
                    ["pdf", "contracts.reports.exportPdf"],
                  ] as const).map(([format, key]) => (
                    <a
                      key={format}
                      href={exportHref(format)}
                      className="btn-secondary inline-flex items-center gap-1.5 text-sm"
                      data-testid={`contract-reports-export-${format}`}
                    >
                      <span className="material-symbols-outlined text-[16px]" aria-hidden>download</span>
                      {t(key)}
                    </a>
                  ))}
                </>
              ) : null}
            </div>
          </div>
        </div>

        {chips.length > 0 ? (
          <div className="no-print flex flex-wrap items-center gap-2" data-testid="contract-reports-chips">
            {chips.map((chip) => (
              <span key={chip.id} className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-700">
                {chip.label}
              </span>
            ))}
            <button
              type="button"
              className="btn-secondary text-xs"
              onClick={clearFilters}
              data-testid="contract-reports-clear-filters"
            >
              {t("contracts.reports.clearFilters")}
            </button>
          </div>
        ) : null}

        <p className="text-xs font-medium text-neutral-500" data-testid="contract-reports-count" aria-live="polite">
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
            <div className="max-h-[min(70vh,44rem)] overflow-auto print:max-h-none print:overflow-visible">
              <table className="data-table" data-testid="contract-reports-table">
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr>
                    {(["severity", "contract", "exception_type", "exception_title", "status"] as const).map((column) => (
                      <th key={column} className={columnVisibilityClass(columnPriority("exceptions", column))}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase tracking-wider"
                          onClick={() => setSort((current) => nextSort(current, column))}
                          aria-sort={sort?.column === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        >
                          {t(`contracts.reports.col.${column}`)}
                          {sort?.column === column ? (
                            <span className="material-symbols-outlined text-[14px]" aria-hidden>
                              {sort.direction === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredExceptions.length === 0 ? (
                    <TableEmpty
                      colSpan={5}
                      icon="report"
                      title={hasSourceRows ? "contracts.reports.emptyExceptionsFiltered" : "contracts.reports.emptyExceptions"}
                    />
                  ) : (
                    filteredExceptions.map((row: ExceptionRow) => {
                      const href = contractHref(row.contract?.id);
                      const typeKey = exceptionTypeLabelKey(row.type);
                      const typeLabel = t(typeKey);
                      return (
                        <tr
                          key={row.id}
                          className={href ? "group cursor-pointer" : "group"}
                          tabIndex={href ? 0 : undefined}
                          onClick={href ? (event) => openContract(href, event) : undefined}
                          onKeyDown={href ? (event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openContract(href);
                            }
                          } : undefined}
                        >
                          <td className={columnVisibilityClass(columnPriority("exceptions", "severity"))}>
                            <span className={`badge ${badgeClass("severity", row.severity)}`}>
                              {displayBadge("severity", row.severity, t)}
                            </span>
                          </td>
                          <td className="sticky left-0 z-[1] bg-white font-mono text-xs group-hover:bg-neutral-50">
                            {href ? (
                              <Link href={href} className="text-primary hover:underline" aria-label={t("contracts.reports.openContract")}>
                                {row.contract?.reference_number ?? "—"}
                              </Link>
                            ) : (
                              <span className="text-neutral-600">{row.contract?.reference_number ?? "—"}</span>
                            )}
                          </td>
                          <td className={`text-sm capitalize ${columnVisibilityClass(columnPriority("exceptions", "exception_type"))}`}>
                            {typeLabel === typeKey ? humanizeToken(row.type) : typeLabel}
                          </td>
                          <td className="max-w-sm truncate text-sm text-neutral-800">{row.title}</td>
                          <td className={columnVisibilityClass(columnPriority("exceptions", "status"))}>
                            <span className={`badge ${badgeClass("status", row.status)}`}>
                              {displayBadge("status", row.status, t)}
                            </span>
                          </td>
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
            <EmptyState
              icon="description"
              title={hasSourceRows ? "contracts.reports.emptyFiltered" : "contracts.reports.empty"}
            />
          </div>
        ) : (
          <div className="card min-w-0 overflow-hidden">
            <div className="max-h-[min(70vh,44rem)] overflow-auto print:max-h-none print:overflow-visible">
              <table className="data-table" data-testid="contract-reports-table">
                <thead className="sticky top-0 z-10 bg-neutral-50">
                  <tr>
                    {columns.map((column) => (
                      <th
                        key={column}
                        className={`whitespace-nowrap ${isMoneyColumn(column) || isNumericColumn(column) ? "text-right" : ""} ${columnVisibilityClass(columnPriority(tab, column))}`}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 uppercase tracking-wider"
                          onClick={() => setSort((current) => nextSort(current, column))}
                          aria-sort={sort?.column === column ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
                        >
                          {t(columnLabelKey(column))}
                          {sort?.column === column ? (
                            <span className="material-symbols-outlined text-[14px]" aria-hidden>
                              {sort.direction === "asc" ? "arrow_upward" : "arrow_downward"}
                            </span>
                          ) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((row, index) => {
                    const href = contractHref(row.id);
                    return (
                      <tr
                        key={typeof row.id === "number" || typeof row.id === "string" ? String(row.id) : index}
                        className={href ? "group cursor-pointer" : "group"}
                        tabIndex={href ? 0 : undefined}
                        onClick={href ? (event) => openContract(href, event) : undefined}
                        onKeyDown={href ? (event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openContract(href);
                          }
                        } : undefined}
                      >
                        {columns.map((column) => {
                          const value = row[column];
                          const text = displayCell(column, value, row, t);
                          const align = isMoneyColumn(column) || isNumericColumn(column) ? "text-right tabular-nums" : "";
                          const visibility = columnVisibilityClass(columnPriority(tab, column));
                          if (column === "reference" && href) {
                            return (
                              <td key={column} className={`sticky left-0 z-[1] bg-white font-mono text-xs group-hover:bg-neutral-50 ${visibility}`}>
                                <Link href={href} className="text-primary hover:underline" aria-label={t("contracts.reports.openContract")}>
                                  {text}
                                </Link>
                              </td>
                            );
                          }
                          if (isBadgeColumn(column)) {
                            return (
                              <td key={column} className={visibility}>
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
                            return <td key={column} className={`text-right tabular-nums ${tone} ${visibility}`}>{text}</td>;
                          }
                          if (column === "title") {
                            return <td key={column} className={`max-w-[16rem] whitespace-normal text-sm text-neutral-800 ${visibility}`}>{text}</td>;
                          }
                          return <td key={column} className={`whitespace-nowrap text-sm ${align} ${visibility}`}>{text}</td>;
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

function ContractReportsFallback() {
  const { t } = useI18n();
  return <div className="card p-6 text-sm text-neutral-500">{t("common.loading")}</div>;
}

export default function ContractReportsPage() {
  return (
    <Suspense fallback={<ContractReportsFallback />}>
      <ContractReportsDesk />
    </Suspense>
  );
}
