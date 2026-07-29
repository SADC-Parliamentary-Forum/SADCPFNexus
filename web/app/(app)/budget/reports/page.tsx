"use client";

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

type TabId = "utilisation" | "ageing" | "changes" | "cycles";
type GroupBy = "line" | "department" | "funding_source";

const TABS: Array<{ id: TabId; label: string }> = [
  { id: "utilisation", label: "Utilisation" },
  { id: "ageing", label: "Commitment ageing" },
  { id: "changes", label: "Change register" },
  { id: "cycles", label: "Cycle status" },
];

const BUCKET_LABELS: Record<string, string> = {
  "0_30": "0–30 days",
  "31_60": "31–60 days",
  "61_90": "61–90 days",
  "90_plus": "90+ days",
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
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Budget reports</h1>
          <p className="page-subtitle">
            Read-only utilisation, commitment ageing, change-request register, and cycle status
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            Budget control
          </Link>
          <Link href="/budget/cashflow" className="btn-secondary text-sm">
            Cashflow
          </Link>
          <a
            className="btn-secondary text-sm"
            href={budgetApi.reportExportUrl(
              tab === "ageing" ? "commitment-ageing" : tab === "changes" ? "change-register" : tab === "cycles" ? "cycle-status" : "utilisation",
              "xlsx",
              { ...filterParams, ...(tab === "utilisation" ? { group_by: groupBy } : {}) },
            )}
          >
            Export XLSX
          </a>
          <a
            className="btn-secondary text-sm"
            href={budgetApi.reportExportUrl(
              tab === "ageing" ? "commitment-ageing" : tab === "changes" ? "change-register" : tab === "cycles" ? "cycle-status" : "utilisation",
              "pdf",
              { ...filterParams, ...(tab === "utilisation" ? { group_by: groupBy } : {}) },
            )}
          >
            Export PDF
          </a>
        </div>
          <Link href="/budget/cashflow" className="btn-secondary text-sm">
            Cashflow
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            Variance
          </Link>
        </div>
      </div>

      <div className="card p-4">
        <label className="block text-sm font-medium text-neutral-700 mb-1">Financial year</label>
        <select
          className="form-input max-w-sm"
          value={financialYearId}
          onChange={(e) => setFinancialYearId(e.target.value)}
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.label || y.code}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border)] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === t.id
                ? "bg-[var(--primary)] text-white"
                : "bg-[var(--surface-muted)] text-neutral-700 hover:bg-neutral-200"
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
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
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-neutral-600">Group by</span>
        {(["line", "department", "funding_source"] as GroupBy[]).map((g) => (
          <button
            key={g}
            type="button"
            className={`rounded-lg px-3 py-1.5 text-sm ${
              groupBy === g ? "bg-neutral-900 text-white" : "btn-secondary"
            }`}
            onClick={() => onGroupBy(g)}
          >
            {g === "funding_source" ? "Funding source" : g.charAt(0).toUpperCase() + g.slice(1)}
          </button>
        ))}
      </div>

      {totals && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          {[
            { label: "Approved", value: totals.approved },
            { label: "Actual", value: totals.actual },
            { label: "Committed", value: totals.committed },
            { label: "Available", value: totals.available },
          ].map((card) => (
            <div key={card.label} className="card p-4">
              <div className="text-sm text-neutral-500 mb-1">{card.label}</div>
              <div className="text-lg font-semibold">NAD {money(card.value)}</div>
            </div>
          ))}
        </div>
      )}

      <ReportTable
        loading={loading}
        error={error}
        empty="No utilisation rows for the selected filters."
        rowCount={rows.length}
        headers={
          groupBy === "line"
            ? ["Code", "Name", "Department", "Funding", "Approved", "Committed", "Actual", "Available", "% utilised"]
            : groupBy === "department"
              ? ["Department", "Lines", "Approved", "Committed", "Actual", "Available", "% utilised"]
              : ["Funding source", "Lines", "Approved", "Committed", "Actual", "Available", "% utilised"]
        }
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
                  {groupBy === "department" ? row.department_name ?? "Unassigned" : row.funding_source_name ?? "Unassigned"}
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
  return (
    <div className="space-y-4">
      {asOf && <p className="text-sm text-neutral-500">As of {fmtDate(asOf)}</p>}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        {Object.entries(BUCKET_LABELS).map(([key, label]) => {
          const bucket = buckets[key] ?? { count: 0, amount: 0 };
          return (
            <div key={key} className="card p-4">
              <div className="text-sm text-neutral-500 mb-1">{label}</div>
              <div className="text-lg font-semibold">NAD {money(bucket.amount)}</div>
              <div className="text-xs text-neutral-500 mt-1">{bucket.count} commitment{bucket.count === 1 ? "" : "s"}</div>
            </div>
          );
        })}
      </div>

      <ReportTable
        loading={loading}
        error={error}
        empty="No open commitments."
        rowCount={items.length}
        headers={["Line", "Source", "Ref", "Amount", "Age", "Bucket", "Status"]}
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
            <td className="px-4 py-3 text-right">{item.age_days}d</td>
            <td className="px-4 py-3">{BUCKET_LABELS[item.age_bucket] ?? item.age_bucket}</td>
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
  return (
    <ReportTable
      loading={loading}
      error={error}
      empty="No change requests in the register."
      rowCount={rows.length}
      headers={["Title", "Type", "Status", "Amount", "Submitted", "Approver path", ""]}
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
            <Link href={`/budget/changes/${row.id}`} className="text-[var(--primary)] hover:underline">
              Open
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
  return (
    <ReportTable
      loading={loading}
      error={error}
      empty="No budget cycles found."
      rowCount={rows.length}
      headers={["FY", "Status", "Opens", "Dept deadline", "SG approved", "Locked", "Submissions", ""]}
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
            <Link href={`/budget/cycles/${row.id}`} className="text-[var(--primary)] hover:underline">
              Open
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
  if (loading) {
    return <p className="text-sm text-[var(--muted)]">Loading…</p>;
  }
  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Failed to load report.
      </div>
    );
  }
  if (rowCount === 0) {
    return <p className="text-sm text-[var(--muted)]">{empty}</p>;
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
