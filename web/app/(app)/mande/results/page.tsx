"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  RESULTS_FRAMEWORK_TYPES,
  mandeApi,
  type ResultsFramework,
  type ResultsFrameworkType,
} from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const FRAMEWORK_TYPE_LABEL: Record<string, string> = {
  sadc_pf: "mande.frameworks.type.sadcPf",
  srhr: "mande.frameworks.type.srhr",
  giz: "mande.frameworks.type.giz",
  donor: "mande.frameworks.type.donor",
  institutional: "mande.frameworks.type.institutional",
};

const FRAMEWORK_STATUS_LABEL: Record<string, string> = {
  active: "mande.plans.status.active",
  archived: "correspondence.status.archived",
  inactive: "mande.frameworks.status.inactive",
};

const EMPTY: Partial<ResultsFramework> = {
  name: "",
  type: "sadc_pf",
  donor_name: "",
  description: "",
  status: "active",
};

export default function ResultsFrameworksPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
  const typeLabel = (value: string, fallback?: string) =>
    FRAMEWORK_TYPE_LABEL[value] ? t(FRAMEWORK_TYPE_LABEL[value]) : fallback ?? value;
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [typeFilter, setTypeFilter] = useState("All");
  const [modal, setModal] = useState<Partial<ResultsFramework> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "results-frameworks", typeFilter],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 100 };
      if (typeFilter !== "All") params.type = typeFilter;
      return mandeApi.listFrameworks(params).then((r) => r.data.data as ResultsFramework[]);
    },
    staleTime: 20_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<ResultsFramework>) =>
      payload.id
        ? mandeApi.updateFramework(payload.id, payload)
        : mandeApi.createFramework(payload),
    onSuccess: () => {
      toast.success(t("mande.frameworks.saved"));
      qc.invalidateQueries({ queryKey: ["mande", "results-frameworks"] });
      setModal(null);
    },
    onError: (err) => toast.error(t("mande.frameworks.notSaved"), apiErrorMessage(err, t("mande.frameworks.saveFailed"))),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => mandeApi.deleteFramework(id),
    onSuccess: () => {
      toast.success(t("mande.frameworks.deleted"));
      qc.invalidateQueries({ queryKey: ["mande", "results-frameworks"] });
    },
    onError: (err) => toast.error(t("mande.frameworks.notDeleted"), apiErrorMessage(err, t("mande.frameworks.deleteFailed"))),
  });

  const frameworks = data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.frameworks.title")}
        subtitle={t("mande.frameworks.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.frameworks.title") }]} />}
      />
        {canAdmin && (
          <button type="button" onClick={() => setModal({ ...EMPTY })} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("mande.frameworks.new")}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {["All", ...RESULTS_FRAMEWORK_TYPES.map((ft) => ft.value)].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setTypeFilter(f)}
            className={`filter-tab ${typeFilter === f ? "active" : ""}`}
          >
            {f === "All" ? t("imprest.list.all") : typeLabel(f, RESULTS_FRAMEWORK_TYPES.find((ft) => ft.value === f)?.label)}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.frameworks.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : frameworks.length === 0 ? (
          <EmptyState icon="account_tree" title={t("mande.frameworks.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("fleet.col.name")}</th>
                <th>{t("correspondence.col.type")}</th>
                <th>{t("mande.frameworks.donor")}</th>
                <th>{t("mande.frameworks.plan")}</th>
                <th>{t("mande.aggregation.indicators")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {frameworks.map((fw) => (
                <tr key={fw.id}>
                  <td className="font-medium text-neutral-900">{fw.name}</td>
                  <td className="text-xs text-neutral-500">
                    {typeLabel(fw.type, RESULTS_FRAMEWORK_TYPES.find((ft) => ft.value === fw.type)?.label)}
                  </td>
                  <td className="text-xs text-neutral-500">{fw.donor_name ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{fw.plan?.name ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{fw.indicators_count ?? "—"}</td>
                  <td>
                    <span className={`badge ${fw.status === "active" ? "badge-success" : "badge-muted"}`}>
                      {FRAMEWORK_STATUS_LABEL[fw.status] ? t(FRAMEWORK_STATUS_LABEL[fw.status]) : fw.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap">
                    {canAdmin && (
                      <>
                        <button type="button" className="btn-secondary text-xs py-1 px-2 mr-3" onClick={() => setModal({ ...fw })}>
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-2 text-red-600"
                          onClick={async () => {
                            if (await confirm({ title: t("mande.frameworks.deleteTitle"), message: t("mande.frameworks.deleteMessage"), variant: "danger" })) {
                              delMut.mutate(fw.id);
                            }
                          }}
                        >
                          {t("common.delete")}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">{modal.id ? t("mande.frameworks.edit") : t("mande.frameworks.new")}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label={t("common.close")} className="text-neutral-400 hover:text-neutral-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="mande-results-name" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.plans.nameRequired")}</label>
                <input id="mande-results-name" className="form-input" value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mande-results-type" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.frameworks.typeRequired")}</label>
                  <select id="mande-results-type"
                    className="form-input"
                    value={modal.type ?? "sadc_pf"}
                    onChange={(e) => setModal({ ...modal, type: e.target.value as ResultsFrameworkType })}
                  >
                    {RESULTS_FRAMEWORK_TYPES.map((ft) => (
                      <option key={ft.value} value={ft.value}>{typeLabel(ft.value, ft.label)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="mande-results-donor-name" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.frameworks.donorName")}</label>
                  <input id="mande-results-donor-name" className="form-input" value={modal.donor_name ?? ""} onChange={(e) => setModal({ ...modal, donor_name: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mande-results-start" className="block text-xs font-semibold text-neutral-700 mb-1">{t("fleet.col.start")}</label>
                  <input id="mande-results-start" type="date" className="form-input" value={modal.start_date?.slice(0, 10) ?? ""} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="mande-results-end" className="block text-xs font-semibold text-neutral-700 mb-1">{t("fleet.col.end")}</label>
                  <input id="mande-results-end"
                    type="date"
                    className="form-input"
                    min={modal.start_date?.slice(0, 10) ?? undefined}
                    value={modal.end_date?.slice(0, 10) ?? ""}
                    onChange={(e) => setModal({ ...modal, end_date: e.target.value })}
                  />
                  {modal.start_date && modal.end_date && modal.end_date < modal.start_date && (
                    <p className="mt-1 text-xs text-red-600">{t("mande.frameworks.endBeforeStart")}</p>
                  )}
                </div>
              </div>
              <div>
                <label htmlFor="mande-results-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("correspondence.contacts.description")}</label>
                <textarea id="mande-results-description" className="form-input min-h-[80px]" value={modal.description ?? ""} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setModal(null)}>{t("common.cancel")}</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-40"
                disabled={!modal.name?.trim() || saveMut.isPending}
                onClick={() => saveMut.mutate(modal)}
              >
                {saveMut.isPending ? t("correspondence.saving") : t("common.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
