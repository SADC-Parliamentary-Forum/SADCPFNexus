"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type PifLinkage } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MandeIntakePage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const { t } = useI18n();
  const canReview = isSystemAdmin(user) || hasPermission(user, ["mande.review", "mande.admin"]);
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [notReportableId, setNotReportableId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "pif-linkages", unlinkedOnly],
    queryFn: () =>
      mandeApi.getPifLinkages(unlinkedOnly ? { unlinked: true } : undefined).then((r) => r.data.data as PifLinkage[]),
    staleTime: 20_000,
  });

  const notReportableMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => mandeApi.markNotReportable(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mande", "pif-linkages"] });
      setNotReportableId(null);
      setReason("");
    },
  });

  const rows = data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.activityReports.intakeQueue")}
        subtitle={t("mande.intake.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.activityReports.intakeQueue") }]} />}
      />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnlinkedOnly(true)}
            className={`filter-tab ${unlinkedOnly ? "active" : ""}`}
          >
            {t("mande.intake.unlinked")}
          </button>
          <button
            type="button"
            onClick={() => setUnlinkedOnly(false)}
            className={`filter-tab ${!unlinkedOnly ? "active" : ""}`}
          >
            {t("mande.intake.allApproved")}
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.intake.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="inbox"
            title={unlinkedOnly ? t("mande.intake.emptyUnlinked") : t("mande.intake.empty")}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("mande.col.pif")}</th>
                <th>{t("mande.col.title")}</th>
                <th>{t("mande.intake.pillar")}</th>
                <th>{t("mande.intake.dates")}</th>
                <th>{t("mande.intake.report")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.reference_number}</td>
                  <td className="font-medium text-neutral-900 max-w-sm">
                    <span className="line-clamp-2">{p.title}</span>
                  </td>
                  <td className="text-xs text-neutral-500">{p.strategic_pillar ?? "—"}</td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {p.start_date ? formatDateShort(p.start_date) : "—"}
                    {" → "}
                    {p.end_date ? formatDateShort(p.end_date) : "—"}
                  </td>
                  <td>
                    {p.has_report ? (
                      <span className="badge badge-success">{t("mande.intake.linked")}</span>
                    ) : (
                      <span className="badge badge-warning">{t("status.pending")}</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {!p.has_report && (
                      <>
                        <Link
                          href={`/mande/activity-reports/create?programme_id=${p.id}`}
                          className="btn-secondary text-xs py-1 px-2 mr-3"
                        >
                          {t("mande.intake.createReport")}
                        </Link>
                        {canReview && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotReportableId(p.id);
                              setReason("");
                            }}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {t("mande.intake.notReportable")}
                          </button>
                        )}
                      </>
                    )}
                    {p.has_report && (
                      <Link href="/mande/activity-reports" className="btn-secondary text-xs py-1 px-2">
                        {t("mande.intake.viewReports")}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {notReportableId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotReportableId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-800">{t("mande.intake.markTitle")}</h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-neutral-600">{t("mande.intake.markHint")}</p>
              <textarea
                className="form-input min-h-[100px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("mande.intake.reasonPlaceholder")}
              />
              {notReportableMut.isError && (
                <p className="text-xs text-red-600">{t("mande.intake.markFailed")}</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setNotReportableId(null)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-40"
                disabled={reason.trim().length < 5 || notReportableMut.isPending}
                onClick={() => notReportableMut.mutate({ id: notReportableId, reason: reason.trim() })}
              >
                {notReportableMut.isPending ? t("correspondence.saving") : t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
