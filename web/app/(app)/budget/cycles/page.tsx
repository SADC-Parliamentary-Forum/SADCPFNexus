"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { budgetApi, type BudgetCycle } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function statusLabel(status: string): string {
  return status.replaceAll("_", " ");
}

export default function BudgetCyclesPage() {
  const { t, localeTag } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();
  const canFinance =
    isSystemAdmin(user) || hasPermission(user, ["finance.create", "finance.approve", "finance.admin"]);

  const [fyId, setFyId] = useState("");
  const [error, setError] = useState("");

  const cyclesQuery = useQuery({
    queryKey: ["budget", "cycles"],
    queryFn: () => budgetApi.cycles().then((r) => r.data.data as BudgetCycle[]),
  });

  const yearsQuery = useQuery({
    queryKey: ["budget", "financial-years"],
    queryFn: () => budgetApi.financialYears().then((r) => r.data.data as Array<{ id: number; code: string; label: string }>),
    enabled: canFinance,
  });

  const createMut = useMutation({
    mutationFn: () => budgetApi.createCycle({ financial_year_id: Number(fyId) }),
    onSuccess: () => {
      setFyId("");
      setError("");
      toast.success(t("budget.cycles.opened"));
      qc.invalidateQueries({ queryKey: ["budget", "cycles"] });
    },
    onError: (err) => {
      setError(t("budget.cycles.openFailed"));
      toast.error(t("budget.cycles.notOpened"), apiErrorMessage(err, t("budget.cycles.openFailed")));
    },
  });

  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);
  const cycles = cyclesQuery.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="budget.cycles.title"
        subtitle="budget.cycles.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.cycles.title" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            {t("budget.control")}
          </Link>
          <Link href="/budget/variance" className="btn-secondary text-sm">
            {t("budget.variance.crumb")}
          </Link>
        </div>
      </div>

      {error && (
        <ErrorBanner message={error} />
      )}

      {canFinance && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-[var(--foreground)]">{t("budget.cycles.openTitle")}</h2>
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="budget-cycles-financial-year-setfyid-e-target-value-select-fy" className="flex flex-col gap-1 text-sm">
              <span className="text-[var(--muted)]">{t("budget.cycles.financialYear")}</span>
              <select id="budget-cycles-financial-year-setfyid-e-target-value-select-fy"
                className="min-w-[220px] rounded-lg border border-[var(--border)] px-3 py-2"
                value={fyId}
                onChange={(e) => setFyId(e.target.value)}
              >
                <option value="">{t("budget.cycles.selectFy")}</option>
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label || y.code}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={!fyId || createMut.isPending}
              onClick={() => createMut.mutate()}
            >
              {t("budget.cycles.openCycle")}
            </button>
          </div>
        </div>
      )}

      {cyclesQuery.isLoading ? (
        <p className="text-sm text-[var(--muted)]">{t("budget.cycles.loading")}</p>
      ) : cycles.length === 0 ? (
        <div className="card">
          <EmptyState icon="event_repeat" title={t("budget.cycles.empty")} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("budget.cycles.financialYear")}</th>
                <th className="px-4 py-3 font-medium">{t("hr.timesheets.monthly.status")}</th>
                <th className="px-4 py-3 font-medium">{t("budget.cycles.approvedTotal")}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {cycles.map((c) => (
                <tr key={c.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{c.financial_year?.label || c.financial_year?.code || `#${c.financial_year_id}`}</td>
                  <td className="px-4 py-3 capitalize">{statusLabel(c.status)}</td>
                  <td className="px-4 py-3">
                    {c.approved_total != null
                      ? Number(c.approved_total).toLocaleString(localeTag, { minimumFractionDigits: 2 })
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/budget/cycles/${c.id}`} className="font-medium text-[var(--primary)]">
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
