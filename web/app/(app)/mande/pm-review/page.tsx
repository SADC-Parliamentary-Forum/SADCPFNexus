"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

export default function ProgrammeReviewQueuePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["mande", "pm-review-queue"],
    queryFn: () => mandeApi.listProgrammeReviewQueue().then((r) => r.data.data as MeActivityReport[]),
    staleTime: 10_000,
  });

  const clearMut = useMutation({
    mutationFn: (id: number) => mandeApi.clearProgrammeReview(id, { notes: notes[id] || undefined }),
    onSuccess: () => {
      toast.success(t("mande.pmReview.cleared"));
      qc.invalidateQueries({ queryKey: ["mande", "pm-review-queue"] });
    },
    onError: (err) => toast.error(t("mande.pmReview.notCleared"), apiErrorMessage(err, t("mande.pmReview.clearFailed"))),
  });

  const returnMut = useMutation({
    mutationFn: (id: number) =>
      mandeApi.returnProgrammeReview(id, { notes: notes[id] || "Returned by programme manager" }),
    onSuccess: () => {
      toast.success(t("mande.pmReview.returned"));
      qc.invalidateQueries({ queryKey: ["mande", "pm-review-queue"] });
    },
    onError: (err) => toast.error(t("mande.pmReview.notReturned"), apiErrorMessage(err, t("mande.pmReview.returnFailed"))),
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("mande.pmReview.title")}
        subtitle={t("mande.pmReview.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.pmReview.title") }]} />}
      />

      {isError && (
        <ErrorBanner message={t("mande.pmReview.loadFailed")} />
      )}

      {isLoading ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : data.length === 0 ? (
        <div className="card">
          <EmptyState icon="rate_review" title={t("mande.pmReview.empty")} />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("correspondence.col.reference")}</th>
                <th>{t("mande.col.title")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th>{t("mande.col.submitted")}</th>
                <th>{t("mande.pmReview.notesActions")}</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/mande/activity-reports/${r.id}`} className="btn-secondary text-xs py-1 px-2">
                      {r.reference_number}
                    </Link>
                  </td>
                  <td className="text-sm">{r.activity_title}</td>
                  <td className="text-xs">{reviewStatusLabel(t, r.review_status)}</td>
                  <td className="text-xs">{r.submitted_at ? formatDateShort(r.submitted_at) : "—"}</td>
                  <td className="space-y-2 min-w-[220px]">
                    <input
                      className="input text-xs w-full"
                      placeholder={t("mande.pmReview.notesPlaceholder")}
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={clearMut.isPending}
                        onClick={() => clearMut.mutate(r.id)}
                      >
                        {t("mande.pmReview.clear")}
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={returnMut.isPending || !(notes[r.id]?.trim())}
                        onClick={() => returnMut.mutate(r.id)}
                      >
                        {t("common.return")}
                      </button>
                    </div>
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
