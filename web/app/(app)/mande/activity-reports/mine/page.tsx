"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
};

export default function MyActivityReportsPage() {
  const user = getStoredUser();
  const { t } = useI18n();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "activity-reports", "mine", search],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 50, mine: 1 };
      if (search.trim()) params.search = search.trim();
      return mandeApi.listReports(params).then((r) => r.data.data as MeActivityReport[]);
    },
    staleTime: 15_000,
    enabled: !!user?.id,
  });

  const rows = data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.mine.title")}
        subtitle={t("mande.mine.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.mine.title") }]} />}
      />
        <Link href="/mande/intake" className="btn-secondary flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">inbox</span>
          {t("mande.intake.crumb")}
        </Link>
      </div>

      <div className="flex justify-end">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("correspondence.search")}
          className="form-input text-sm max-w-xs"
        />
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.mine.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="assignment_ind" title={t("mande.mine.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("correspondence.col.reference")}</th>
                <th>{t("mande.col.activity")}</th>
                <th>{t("mande.col.pif")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th>{t("mande.col.updated")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {reviewStatusLabel(t, r.review_status)}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-400">{formatDateShort(r.updated_at)}</td>
                  <td>
                    <Link href={`/mande/activity-reports/${r.id}`} className="btn-secondary text-xs py-1 px-2">
                      {t("common.open")}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
