"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

const STATUS_BADGE: Record<string, string> = {
  submitted: "badge-warning",
  reviewed: "badge-primary",
  returned: "badge-danger",
  accepted: "badge-success",
};

export default function ReviewQueuePage() {
  const { t } = useI18n();
  const [filter, setFilter] = useState<"submitted" | "reviewed" | "both">("both");

  const { data: submitted = [], isLoading: loadingSubmitted, isError: errSubmitted } = useQuery({
    queryKey: ["mande", "review-queue", "submitted"],
    queryFn: () =>
      mandeApi.listReports({ review_status: "submitted", per_page: 100 }).then(
        (r) => r.data.data as MeActivityReport[]
      ),
    staleTime: 15_000,
  });

  const { data: reviewed = [], isLoading: loadingReviewed, isError: errReviewed } = useQuery({
    queryKey: ["mande", "review-queue", "reviewed"],
    queryFn: () =>
      mandeApi.listReports({ review_status: "reviewed", per_page: 100 }).then(
        (r) => r.data.data as MeActivityReport[]
      ),
    staleTime: 15_000,
  });

  const isLoading = loadingSubmitted || loadingReviewed;
  const isError = errSubmitted || errReviewed;

  let rows: MeActivityReport[] = [];
  if (filter === "submitted") rows = submitted;
  else if (filter === "reviewed") rows = reviewed;
  else rows = [...submitted, ...reviewed].sort((a, b) => {
    const ta = a.submitted_at ?? a.updated_at;
    const tb = b.submitted_at ?? b.updated_at;
    return tb.localeCompare(ta);
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("mande.reviewQueue.title")}
        subtitle={t("mande.reviewQueue.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.reviewQueue.title") }]} />}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "both", label: "mande.reviewQueue.both" },
            { value: "submitted", label: "status.submitted" },
            { value: "reviewed", label: "mande.reviewQueue.reviewed" },
          ] as const
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`filter-tab ${filter === f.value ? "active" : ""}`}
          >
            {t(f.label)}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.reviewQueue.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <EmptyState icon="rate_review" title={t("mande.reviewQueue.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("correspondence.col.reference")}</th>
                <th>{t("mande.col.activity")}</th>
                <th>{t("mande.col.pif")}</th>
                <th>{t("mande.col.officer")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th>{t("mande.col.submitted")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{r.responsibleOfficer?.name ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {reviewStatusLabel(t, r.review_status)}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-400">
                    {r.submitted_at ? formatDateShort(r.submitted_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/mande/activity-reports/${r.id}`} className="btn-secondary text-xs py-1 px-2">
                      {t("mande.reviewQueue.review")}
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
