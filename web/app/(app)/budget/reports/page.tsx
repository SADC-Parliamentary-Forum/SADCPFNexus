"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  budgetApi,
  type BudgetChangeRegisterRow,
  type BudgetCommitmentAgeingItem,
  type BudgetCycleStatusRow,
  type BudgetUtilisationRow,
} from "@/lib/api";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type TabId = "utilisation" | "ageing" | "changes" | "cycles";
type GroupBy = "line" | "department" | "funding_source";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "utilisation", label: "budget.reports.tab.utilisation" },
  { id: "ageing", label: "budget.reports.tab.ageing" },
  { id: "changes", label: "budget.reports.tab.changes" },
  { id: "cycles", label: "budget.reports.tab.cycles" },
];

const BUCKET_LABELS: Record<string, string> = {
  "0_30": "budget.reports.bucket.0_30",
  "31_60": "budget.reports.bucket.31_60",
  "61_90": "budget.reports.bucket.61_90",
  "90_plus": "budget.reports.bucket.90_plus",
};

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(value?: string | null): string {
  if (!value) return "—";
  return value.slice(0, 10);
}

function fmtPct(n: number): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

export default function BudgetReportsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<TabId>("utilisation");
  const [groupBy, setGroupBy] = useState<GroupBy>("line");
  const [financialYearId, setFinancialYearId] = useState<string>("");

  const yearsQuery = useQuery({
    queryKey: ["budget", "financial-years"],
    queryFn: () => budgetApi.financialYears().then((r) => (r.data.data ?? []) as Array<{ id: number; code: string; label: string }>),
  });

  const filterParams = useMemo(() => {
    const params: Record<string, string | number | boolean> = {};
    if (financialYearId) params.financial_year_id = Number(financialYearId);
    return params;
  }, [financialYearId]);

  const utilisationQuery = useQuery({
    queryKey: ["budget", "reports", "utilisation", filterParams, groupBy],
    enabled: tab === "utilisation",
    queryFn: () =>
      budgetApi
        .reportUtilisation({ ...filterParams, group_by: groupBy })
        .then((r) => r.data.data),
  });

  const ageingQuery = useQuery({
    queryKey: ["budget", "reports", "ageing", filterParams],
    enabled: tab === "ageing",
    queryFn: () => budgetApi.reportCommitmentAgeing(filterParams).then((r) => r.data.data),
  });

  const changesQuery = useQuery({
    queryKey: ["budget", "reports", "changes", filterParams],
    enabled: tab === "changes",
    queryFn: () => budgetApi.reportChangeRegister(filterParams).then((r) => r.data.data),
  });

  const cyclesQuery = useQuery({
    queryKey: ["budget", "reports", "cycles", filterParams],
    enabled: tab === "cycles",
    queryFn: () => budgetApi.reportCycleStatus(filterParams).then((r) => r.data.data),
  });

  const years = yearsQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="budget.reports.title"
        subtitle="budget.reports.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.reports.title" }]} />}
      />
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            {t("budget.variance.budgetControl")}
          </Link>
          <Link href="/budget/cashflow" className="btn-secondary text-sm">
            {t("budget.reports.cashflow")}
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            {t("budget.variance.crumb")}
          </Link>
          <a
            className="btn-secondary text-sm"
            href={budgetApi.reportExportUrl(
              tab === "ageing" ? "commitment-ageing" : tab === "changes" ? "change-register" : tab === "cycles" ? "cycle-status" : "utilisation",
              "xlsx",
              { ...filterParams, ...(tab === "utilisation" ? { group_by: groupBy } : {}) },
            )}
          >
            {t("budget.reports.exportXlsx")}
          </a>
          <a
            className="btn-secondary text-sm"
            href={budgetApi.reportExportUrl(
              tab === "ageing" ? "commitment-ageing" : tab === "changes" ? "change-register" : tab === "cycles" ? "cycle-status" : "utilisation",
              "pdf",
              { ...filterParams, ...(tab === "utilisation" ? { group_by: groupBy } : {}) },
            )}
          >
            {t("assets.register.exportPdf")}
          </a>
        </div>
      </div>

      <div className="card p-4">
        <label htmlFor="budget-reports-financial-year" className="block text-sm font-medium text-neutral-700 mb-1">{t("budget.cycles.financialYear")}</label>
        <select id="budget-reports-financial-year"
          className="form-input max-w-sm"
          value={financialYearId}
          onChange={(e) => setFinancialYearId(e.target.value)}
        >
          <option value="">{t("budget.reports.allYears")}</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label || y.code}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {TABS.map((tabItem) => (
          <button
            key={tabItem.id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === tabItem.id
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-muted)] text-neutral-700 hover:bg-neutral-200"
            }`}
            onClick={() => setTab(tabItem.id)}
          >
            {t(tabItem.label)}
          </button>
        ))}
      </div>

      {tab === "utilisation" && (
        <UtilisationPanel
          groupBy={groupBy}
          onGroupBy={setGroupBy}
          loading={utilisationQuery.isLoading}
          error={utilisationQuery.isError}
          rows={utilisationQuery.data?.rows ?? []}
          totals={utilisationQuery.data?.totals}
        />
      )}

      {tab === "ageing" && (
        <AgeingPanel
          loading={ageingQuery.isLoading}
          error={ageingQuery.isError}
          buckets={ageingQuery.data?.buckets ?? {}}
          items={ageingQuery.data?.items ?? []}
          asOf={ageingQuery.data?.as_of}
        />
      )}

      {tab === "changes" && (
        <ChangesPanel
          loading={changesQuery.isLoading}
          error={changesQuery.isError}
          rows={changesQuery.data?.rows ?? []}
        />
      )}

      {tab === "cycles" && (
        <CyclesPanel
          loading={cyclesQuery.isLoading}
          error={cyclesQuery.isError}
          rows={cyclesQuery.data?.rows ?? []}
        />
      )}
    </div>
  );
}

function UtilisationPanel({
  groupBy,
  onGroupBy,
  loading,
  error,
  rows,
  totals,
}: {
  groupBy: GroupBy;
  onGroupBy: (v: GroupBy) => void;
  loading: boolean;
  error: boolean;
  rows: BudgetUtilisationRow[];
  totals?: { approved: number; actual: number; committed: number; available: number; line_count: number };
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">{t("budget.reports.groupBy")}</span>
        {(["line", "department", "funding_source"] as GroupBy[]).map((g) => (
          <button
            key={g}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              groupBy === g ? "bg-neutral-900 text-white" : "btn-secondary"
            }`}
            onClick={() => onGroupBy(g)}
          >
            {t(`budget.reports.group.${g}`)}
          </button>
        ))}
      </div>

      {totals && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: t("budget.reports.col.approved"), value: totals.approved },
            { label: t("budget.variance.actual"), value: totals.actual },
            { label: t("budget.reports.col.committed"), value: totals.committed },
            { label: t("budget.reports.col.available"), value: totals.available },
          ].map((card) => (
            <div key={card.label} className="card p-4">
              <div className="text-sm text-neutral-500 mb-1">{card.label}</div>
              <div className="text-lg font-semibold">NAD {money(card.value)}</div>{/* i18n-ignore */}
            </div>
          ))}
        </div>
      )}

      <ReportTable
        loading={loading}
        error={error}
        empty={t("budget.reports.emptyUtilisation")}
        rowCount={rows.length}
        headers={(
          groupBy === "line"
            ? ["budget.reports.col.code", "budget.reports.col.name", "budget.reports.col.department", "budget.reports.col.funding", "budget.reports.col.approved", "budget.reports.col.committed", "budget.variance.actual", "budget.reports.col.available", "budget.reports.col.pctUtilised"]
            : groupBy === "department"
              ? ["budget.reports.col.department", "budget.reports.col.lines", "budget.reports.col.approved", "budget.reports.col.committed", "budget.variance.actual", "budget.reports.col.available", "budget.reports.col.pctUtilised"]
              : ["budget.reports.group.funding_source", "budget.reports.col.lines", "budget.reports.col.approved", "budget.reports.col.committed", "budget.variance.actual", "budget.reports.col.available", "budget.reports.col.pctUtilised"]
        ).map((key) => t(key))}
      >
        {rows.map((row, idx) => (
          <tr key={row.budget_line_id ?? `${row.department_id}-${row.funding_source_id}-${idx}`} className="border-b border-[var(--border)] last:border-0">
            {groupBy === "line" ? (
              <>
                <td className="px-4 py-3 font-mono text-sm">{row.code ?? "—"}</td>
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.department_name ?? "—"}</td>
                <td className="px-4 py-3">{row.funding_source_name ?? "—"}</td>
              </>
            ) : (
              <>
                <td className="px-4 py-3">
                  {groupBy === "department" ? row.department_name ?? t("budget.reports.unassigned") : row.funding_source_name ?? t("budget.reports.unassigned")}
                </td>
                <td className="px-4 py-3">{row.line_count ?? "—"}</td>
              </>
            )}
            <td className="px-4 py-3 text-right">{money(row.approved)}</td>
            <td className="px-4 py-3 text-right">{money(row.committed)}</td>
            <td className="px-4 py-3 text-right">{money(row.actual)}</td>
            <td className={`px-4 py-3 text-right font-semibold ${row.available < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {money(row.available)}
            </td>
            <td className="px-4 py-3 text-right">{fmtPct(row.pct_utilised)}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function AgeingPanel({
  loading,
  error,
  buckets,
  items,
  asOf,
}: {
  loading: boolean;
  error: boolean;
  buckets: Record<string, { count: number; amount: number }>;
  items: BudgetCommitmentAgeingItem[];
  asOf?: string;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      {asOf && <p className="text-sm text-neutral-500">{t("budget.reports.asOf", { date: fmtDate(asOf) })}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Object.entries(BUCKET_LABELS).map(([key, label]) => {
          const bucket = buckets[key] ?? { count: 0, amount: 0 };
          return (
            <div key={key} className="card p-4">
              <div className="text-sm text-neutral-500 mb-1">{t(label)}</div>
              <div className="text-lg font-semibold">NAD {money(bucket.amount)}</div>{/* i18n-ignore */}
              <div className="text-xs text-neutral-500 mt-1">{t(bucket.count === 1 ? "budget.reports.commitmentOne" : "budget.reports.commitmentMany", { count: bucket.count })}</div>
            </div>
          );
        })}
      </div>

      <ReportTable
        loading={loading}
        error={error}
        empty={t("budget.reports.emptyAgeing")}
        rowCount={items.length}
        headers={[
          t("budget.changeCreate.line"),
          t("budget.fx.source"),
          t("budget.reports.col.ref"),
          t("budget.amount"),
          t("budget.reports.col.age"),
          t("budget.reports.col.bucket"),
          t("budget.reports.col.status"),
        ]}
      >
        {items.map((item) => (
          <tr key={item.id} className="border-b border-[var(--border)] last:border-0">
            <td className="px-4 py-3">
              <div className="font-mono text-xs text-neutral-500">{item.budget_line_code ?? `BL-${item.budget_line_id}`}</div>
              <div>{item.budget_line_name ?? "—"}</div>
            </td>
            <td className="px-4 py-3 capitalize">{item.source_type ?? "—"}</td>
            <td className="px-4 py-3 font-mono text-sm">{item.source_key ?? "—"}</td>
            <td className="px-4 py-3 text-right">{money(item.amount)}</td>
            <td className="px-4 py-3 text-right">{t("budget.reports.ageDays", { days: item.age_days })}</td>
            <td className="px-4 py-3">{BUCKET_LABELS[item.age_bucket] ? t(BUCKET_LABELS[item.age_bucket]) : item.age_bucket}</td>
            <td className="px-4 py-3 capitalize">{item.status.replaceAll("_", " ")}</td>
          </tr>
        ))}
      </ReportTable>
    </div>
  );
}

function ChangesPanel({
  loading,
  error,
  rows,
}: {
  loading: boolean;
  error: boolean;
  rows: BudgetChangeRegisterRow[];
}) {
  const { t } = useI18n();
  return (
    <ReportTable
      loading={loading}
      error={error}
      empty={t("budget.reports.emptyChanges")}
      rowCount={rows.length}
      headers={[
        t("budget.reports.col.title"),
        t("budget.reports.col.type"),
        t("budget.reports.col.status"),
        t("budget.amount"),
        t("budget.reports.col.submitted"),
        t("budget.reports.col.approverPath"),
        "",
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
          <td className="px-4 py-3">
            <div className="font-medium">{row.title}</div>
            <div className="text-xs text-neutral-500">{row.budget_name}</div>
          </td>
          <td className="px-4 py-3 capitalize">{row.type}</td>
          <td className="px-4 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
          <td className="px-4 py-3 text-right">{money(row.total_amount)}</td>
          <td className="px-4 py-3">{fmtDate(row.submitted_at)}</td>
          <td className="px-4 py-3 text-xs text-neutral-600">
            {row.approver_path.map((step) => step.label).join(" → ")}
          </td>
          <td className="px-4 py-3 text-right">
            <Link href={`/budget/changes/${row.id}`} className="font-medium text-[var(--primary)]">
              {t("common.open")}
            </Link>
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

function CyclesPanel({
  loading,
  error,
  rows,
}: {
  loading: boolean;
  error: boolean;
  rows: BudgetCycleStatusRow[];
}) {
  const { t } = useI18n();
  return (
    <ReportTable
      loading={loading}
      error={error}
      empty={t("budget.reports.emptyCycles")}
      rowCount={rows.length}
      headers={[
        t("budget.reports.col.fy"),
        t("budget.reports.col.status"),
        t("budget.reports.col.opens"),
        t("budget.reports.col.deptDeadline"),
        t("budget.reports.col.sgApproved"),
        t("budget.reports.col.locked"),
        t("budget.reports.col.submissions"),
        "",
      ]}
    >
      {rows.map((row) => (
        <tr key={row.id} className="border-b border-[var(--border)] last:border-0">
          <td className="px-4 py-3">{row.financial_year_label || row.financial_year_code || "—"}</td>
          <td className="px-4 py-3 capitalize">{row.status.replaceAll("_", " ")}</td>
          <td className="px-4 py-3">{fmtDate(row.submission_opens_on)}</td>
          <td className="px-4 py-3">{fmtDate(row.department_deadline)}</td>
          <td className="px-4 py-3">{fmtDate(row.sg_approved_at)}</td>
          <td className="px-4 py-3">{fmtDate(row.locked_at)}</td>
          <td className="px-4 py-3">
            {row.submission_total}
            {Object.keys(row.submission_counts || {}).length > 0 && (
              <div className="text-xs text-neutral-500">
                {Object.entries(row.submission_counts)
                  .map(([status, count]) => `${status}: ${count}`)
                  .join(", ")}
              </div>
            )}
          </td>
          <td className="px-4 py-3 text-right">
            <Link href={`/budget/cycles/${row.id}`} className="font-medium text-[var(--primary)]">
              {t("common.open")}
            </Link>
          </td>
        </tr>
      ))}
    </ReportTable>
  );
}

function ReportTable({
  loading,
  error,
  empty,
  headers,
  rowCount,
  children,
}: {
  loading: boolean;
  error: boolean;
  empty: string;
  headers: string[];
  rowCount: number;
  children: ReactNode;
}) {
  const { t } = useI18n();
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>;
  }
  if (error) {
    return <ErrorBanner message={t("budget.reports.loadFailed")} />;
  }
  if (rowCount === 0) {
    return (
      <div className="card">
        <EmptyState icon="table_chart" title={empty} className="py-8 min-h-0" />
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
          <tr>
            {headers.map((h) => (
              <th key={h || "actions"} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
