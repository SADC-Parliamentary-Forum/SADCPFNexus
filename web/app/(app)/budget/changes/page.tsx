"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { budgetApi, type BudgetChangeRequest } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function unwrap(payload: unknown): BudgetChangeRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as BudgetChangeRequest[];
  if (data && typeof data === "object" && "data" in (data as object)) {
    const nested = (data as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as BudgetChangeRequest[];
  }
  return [];
}

export default function BudgetChangesPage() {
  const { t } = useI18n();
  const query = useQuery({
    queryKey: ["budget", "changes"],
    queryFn: () => budgetApi.changes({ per_page: 100 }).then((r) => unwrap(r.data)),
  });

  const rows = query.data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="budget.changes.title"
        subtitle="budget.changes.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.changes.title" }]} />}
      />
        <div className="flex gap-2">
          <Link href="/budget" className="btn-secondary text-sm">
            {t("budget.control")}
          </Link>
          <Link href="/budget/changes/create" className="btn-primary text-sm">
            {t("budget.changes.new")}
          </Link>
        </div>
      </div>

      {query.isLoading ? (
        <p className="text-sm text-[var(--muted)]">{t("common.loading")}</p>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="swap_horiz" title={t("budget.changes.empty")} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3 font-medium">{t("srhr.reports.colTitle")}</th>
                <th className="px-4 py-3 font-medium">{t("srhr.col.type")}</th>
                <th className="px-4 py-3 font-medium">{t("hr.timesheets.monthly.status")}</th>
                <th className="px-4 py-3 font-medium">{t("budget.changes.sgColumn")}</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-4 py-3">{r.title}</td>
                  <td className="px-4 py-3 capitalize">{r.type}</td>
                  <td className="px-4 py-3 capitalize">{r.status.replaceAll("_", " ")}</td>
                  <td className="px-4 py-3">{r.requires_sg ? t("budget.yes") : t("budget.no")}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/budget/changes/${r.id}`} className="font-medium text-[var(--primary)]">
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
