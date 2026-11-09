"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport, type MeReviewStatus } from "@/lib/api";
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
  not_reportable: "badge-muted",
  cancelled: "badge-danger",
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "All", label: "imprest.list.all" },
  { value: "not_submitted", label: "status.draft" },
  { value: "submitted", label: "status.submitted" },
  { value: "returned", label: "imprest.status.returned" },
  { value: "reviewed", label: "mande.filter.reviewed" },
  { value: "accepted", label: "mande.filter.accepted" },
  { value: "closed", label: "correspondence.status.closed" },
];

export default function ActivityReportsPage() {
  const { t } = useI18n();
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "activity-reports", status, search],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 50 };
      if (status !== "All") params.review_status = status;
      if (search.trim()) params.search = search.trim();
      return mandeApi.listReports(params).then((r) => r.data.data as MeActivityReport[]);
    },
    staleTime: 15_000,
  });

  const rows = data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.activityReports.title")}
        subtitle={t("mande.activityReports.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.activityReports.title") }]} />}
      />
        <Link href="/mande/intake" className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">inbox</span>
          {t("mande.activityReports.intakeQueue")}
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`filter-tab ${status === f.value ? "active" : ""}`}
          >
            {t(f.label)}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("mande.activityReports.search")}
          className="ml-auto form-input text-sm max-w-xs"
        />
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.activityReports.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="description" title={t("mande.activityReports.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("correspondence.col.reference")}</th>
                <th>{t("mande.col.activity")}</th>
                <th>{t("mande.col.pif")}</th>
                <th>{t("mande.col.officer")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th>{t("mande.col.updated")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900 max-w-xs">
                    <span className="line-clamp-2">{r.activity_title}</span>
                  </td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{r.responsibleOfficer?.name ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {reviewStatusLabel(t, String(r.review_status as MeReviewStatus))}
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
