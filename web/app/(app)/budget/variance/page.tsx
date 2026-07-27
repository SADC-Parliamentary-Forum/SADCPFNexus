"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetVarianceRow } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";

const CATEGORIES = [
  { value: "timing", label: "Timing" },
  { value: "underspend", label: "Underspend" },
  { value: "overspend", label: "Overspend" },
  { value: "activity_delayed", label: "Activity delayed" },
  { value: "activity_cancelled", label: "Activity cancelled" },
  { value: "price_increase", label: "Price increase" },
  { value: "exchange_rate", label: "Exchange rate" },
  { value: "procurement_saving", label: "Procurement saving" },
  { value: "participant_variation", label: "Participant variation" },
  { value: "donor_change", label: "Donor change" },
  { value: "scope_change", label: "Scope change" },
  { value: "unplanned_expenditure", label: "Unplanned expenditure" },
  { value: "other", label: "Other" },
];

function unwrapRows(payload: unknown): BudgetVarianceRow[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as BudgetVarianceRow[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as BudgetVarianceRow[];
  }
  return [];
}

function money(n: number): string {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function BudgetVariancePage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);

  const [significantOnly, setSignificantOnly] = useState(true);
  const [explainFor, setExplainFor] = useState<BudgetVarianceRow | null>(null);
  const [category, setCategory] = useState("activity_delayed");
  const [explanation, setExplanation] = useState("");
  const [remedial, setRemedial] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ["budget", "variance", significantOnly],
    queryFn: () =>
      budgetApi
        .variances({ significant_only: significantOnly, per_page: 100 })
        .then((res) => unwrapRows(res.data)),
  });

  const scanMut = useMutation({
    mutationFn: () => budgetApi.scanVariances(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", "variance"] }),
  });

  const explainMut = useMutation({
    mutationFn: () =>
      budgetApi.explainVariance(explainFor!.id, {
        category,
        explanation: explanation.trim(),
        remedial_action: remedial.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["budget", "variance"] });
      setExplainFor(null);
      setExplanation("");
      setRemedial("");
      setFormError(null);
    },
    onError: (err: unknown) => {
      setFormError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to submit explanation.",
      );
    },
  });

  const reviewMut = useMutation({
    mutationFn: (payload: { id: number; decision: "accepted" | "returned" }) =>
      budgetApi.reviewVarianceExplanation(payload.id, { decision: payload.decision }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget", "variance"] }),
  });

  const rows = listQuery.data ?? [];
  const significantCount = useMemo(() => rows.filter((r) => r.is_significant).length, [rows]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Budget variance</h1>
          <p className="page-subtitle">
            YTD approved vs actual. Significant variance default threshold: 20% (Accounting Manual guideline).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            Budget control
          </Link>
          <Link href="/budget/reports" className="btn-secondary text-sm">
            Reports
          </Link>
          {canFinance && (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={scanMut.isPending}
              onClick={() => scanMut.mutate()}
            >
              {scanMut.isPending ? "Scanning…" : "Run variance scan"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={significantOnly}
            onChange={(e) => setSignificantOnly(e.target.checked)}
          />
          Significant only
        </label>
        <span className="text-sm text-neutral-500">
          Showing {rows.length} row(s) · {significantCount} significant
        </span>
      </div>

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase text-neutral-500">Line</th>
                <th className="text-right text-xs uppercase text-neutral-500">Approved</th>
                <th className="text-right text-xs uppercase text-neutral-500">Actual</th>
                <th className="text-right text-xs uppercase text-neutral-500">Variance</th>
                <th className="text-right text-xs uppercase text-neutral-500">%</th>
                <th className="text-left text-xs uppercase text-neutral-500">Status</th>
                <th className="text-right text-xs uppercase text-neutral-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {listQuery.isLoading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-neutral-500">
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center italic text-neutral-500">
                    No variance snapshots yet. Finance can run a scan.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const latest = row.explanations?.[0];
                  return (
                    <tr key={row.id} className={row.is_significant ? "bg-amber-50/40" : undefined}>
                      <td>
                        <div className="font-medium text-neutral-900">
                          {row.budget_line?.code ?? `BL-${row.budget_line_id}`}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {row.budget_line?.name ?? row.budget_line?.category}
                        </div>
                      </td>
                      <td className="text-right">{money(row.approved_budget)}</td>
                      <td className="text-right">{money(row.actual_expenditure)}</td>
                      <td className="text-right font-medium">{money(row.variance_amount)}</td>
                      <td className={`text-right font-semibold ${row.is_significant ? "text-amber-700" : "text-neutral-700"}`}>
                        {row.variance_pct != null ? `${row.variance_pct}%` : "—"}
                      </td>
                      <td className="text-xs capitalize">{row.status.replaceAll("_", " ")}</td>
                      <td className="text-right space-x-2">
                        {row.status === "explanation_required" && (
                          <button
                            type="button"
                            className="btn-secondary text-xs py-1 px-2"
                            onClick={() => {
                              setExplainFor(row);
                              setFormError(null);
                            }}
                          >
                            Explain
                          </button>
                        )}
                        {canFinance && latest?.status === "submitted" && (
                          <>
                            <button
                              type="button"
                              className="btn-primary text-xs py-1 px-2"
                              onClick={() => reviewMut.mutate({ id: latest.id, decision: "accepted" })}
                            >
                              Accept
                            </button>
                            <button
                              type="button"
                              className="btn-secondary text-xs py-1 px-2"
                              onClick={() => reviewMut.mutate({ id: latest.id, decision: "returned" })}
                            >
                              Return
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {explainFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setExplainFor(null)}>
          <div className="card w-full max-w-lg p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold">Variance explanation</h2>
            <p className="text-xs text-neutral-500">
              {explainFor.budget_line?.code} · variance {explainFor.variance_pct}%
            </p>
            {formError && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</div>}
            <div>
              <label className="block text-xs font-semibold mb-1">Category</label>
              <select className="form-input w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Explanation</label>
              <textarea className="form-input w-full h-24" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Remedial action</label>
              <textarea className="form-input w-full h-20" value={remedial} onChange={(e) => setRemedial(e.target.value)} />
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-secondary flex-1" onClick={() => setExplainFor(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary flex-1 disabled:opacity-50"
                disabled={explainMut.isPending || !explanation.trim()}
                onClick={() => explainMut.mutate()}
              >
                {explainMut.isPending ? "Saving…" : "Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
