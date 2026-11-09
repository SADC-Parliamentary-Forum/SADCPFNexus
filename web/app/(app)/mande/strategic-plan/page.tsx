"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type StrategicPlan } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const PLAN_STATUS_LABEL: Record<string, string> = {
  draft: "status.draft",
  active: "mande.plans.status.active",
  archived: "correspondence.status.archived",
};

const EMPTY: Partial<StrategicPlan> = {
  name: "",
  period: "",
  start_date: "",
  end_date: "",
  description: "",
  status: "draft",
};

export default function StrategicPlanPage() {
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const { t } = useI18n();
  const user = getStoredUser();
  const canAdmin = isSystemAdmin(user) || hasPermission(user, "mande.admin");
  const [modal, setModal] = useState<Partial<StrategicPlan> | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "strategic-plans"],
    queryFn: () =>
      mandeApi.listPlans({ per_page: 100 }).then((r) => r.data.data as StrategicPlan[]),
    staleTime: 20_000,
  });

  const saveMut = useMutation({
    mutationFn: (payload: Partial<StrategicPlan>) =>
      payload.id
        ? mandeApi.updatePlan(payload.id, payload)
        : mandeApi.createPlan(payload),
    onSuccess: () => {
      toast.success(t("mande.plans.saved"));
      qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
      setModal(null);
    },
    onError: (err) => toast.error(t("mande.plans.notSaved"), apiErrorMessage(err, t("mande.plans.saveFailed"))),
  });

  const archiveMut = useMutation({
    mutationFn: (id: number) => mandeApi.archivePlan(id),
    onSuccess: () => {
      toast.success(t("mande.plans.archived"));
      qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
    },
    onError: (err) => toast.error(t("mande.plans.notArchived"), apiErrorMessage(err, t("mande.plans.archiveFailed"))),
  });

  const activateMut = useMutation({
    mutationFn: (id: number) => mandeApi.activatePlan(id),
    onSuccess: () => {
      toast.success(t("mande.plans.activated"));
      qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
    },
    onError: (err) => toast.error(t("mande.plans.notActivated"), apiErrorMessage(err, t("mande.plans.activateFailed"))),
  });

  const delMut = useMutation({
    mutationFn: (id: number) => mandeApi.deletePlan(id),
    onSuccess: () => {
      toast.success(t("mande.plans.deleted"));
      qc.invalidateQueries({ queryKey: ["mande", "strategic-plans"] });
    },
    onError: (err) => toast.error(t("mande.plans.notDeleted"), apiErrorMessage(err, t("mande.plans.deleteFailed"))),
  });

  const plans = data ?? [];

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.plans.title")}
        subtitle={t("mande.plans.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.plans.title") }]} />}
      />
        {canAdmin && (
          <button type="button" onClick={() => setModal({ ...EMPTY })} className="btn-primary flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("mande.plans.new")}
          </button>
        )}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {t("mande.plans.loadFailed")}
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
        ) : plans.length === 0 ? (
          <EmptyState icon="flag" title={t("mande.plans.empty")} />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("fleet.col.name")}</th>
                <th>{t("mande.plans.period")}</th>
                <th>{t("mande.intake.dates")}</th>
                <th>{t("correspondence.col.status")}</th>
                <th>{t("mande.plans.goals")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-neutral-900">{p.name}</td>
                  <td className="text-xs text-neutral-500">{p.period ?? "—"}</td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {p.start_date ? formatDateShort(p.start_date) : "—"}
                    {" → "}
                    {p.end_date ? formatDateShort(p.end_date) : "—"}
                  </td>
                  <td>
                    <span className={`badge ${p.status === "active" ? "badge-success" : p.status === "archived" ? "badge-muted" : "badge-warning"}`}>
                      {PLAN_STATUS_LABEL[p.status] ? t(PLAN_STATUS_LABEL[p.status]) : p.status}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-500">{p.goals_count ?? "—"}</td>
                  <td className="whitespace-nowrap">
                    <Link
                      href={`/mande/strategic-plan/${p.id}`}
                      className="btn-secondary text-xs py-1 px-2 mr-3"
                    >
                      {canAdmin ? t("mande.plans.manageHierarchy") : t("common.open")}
                    </Link>
                    {canAdmin && (
                      <>
                        <button type="button" className="btn-secondary text-xs py-1 px-2 mr-3" onClick={() => setModal({ ...p })}>
                          {t("common.edit")}
                        </button>
                        {p.status !== "active" && (
                          <button type="button" className="btn-secondary text-xs py-1 px-2 mr-3" onClick={() => activateMut.mutate(p.id)}>
                            {t("mande.plans.activate")}
                          </button>
                        )}
                        {p.status !== "archived" && (
                          <button type="button" className="btn-secondary text-xs py-1 px-2 mr-3" onClick={() => archiveMut.mutate(p.id)}>
                            {t("mande.plans.archive")}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary text-xs py-1 px-2 text-red-600"
                          onClick={async () => {
                            if (await confirm({ title: t("mande.plans.deleteTitle"), message: t("mande.plans.deleteMessage"), variant: "danger" })) {
                              delMut.mutate(p.id);
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
              <h2 className="font-semibold text-neutral-800">{modal.id ? t("mande.plans.edit") : t("mande.plans.new")}</h2>
              <button type="button" onClick={() => setModal(null)} className="text-neutral-400 hover:text-neutral-700">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label htmlFor="mande-strategic-plan-name" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.plans.nameRequired")}</label>
                <input id="mande-strategic-plan-name" className="form-input" value={modal.name ?? ""} onChange={(e) => setModal({ ...modal, name: e.target.value })} />
              </div>
              <div>
                <label htmlFor="mande-strategic-plan-period" className="block text-xs font-semibold text-neutral-700 mb-1">{t("mande.plans.period")}</label>
                <input id="mande-strategic-plan-period" className="form-input" value={modal.period ?? ""} onChange={(e) => setModal({ ...modal, period: e.target.value })} placeholder={t("mande.plans.periodPlaceholder")} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mande-strategic-plan-start" className="block text-xs font-semibold text-neutral-700 mb-1">{t("fleet.col.start")}</label>
                  <input id="mande-strategic-plan-start" type="date" className="form-input" value={modal.start_date?.slice(0, 10) ?? ""} onChange={(e) => setModal({ ...modal, start_date: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="mande-strategic-plan-end" className="block text-xs font-semibold text-neutral-700 mb-1">{t("fleet.col.end")}</label>
                  <input id="mande-strategic-plan-end" type="date" className="form-input" value={modal.end_date?.slice(0, 10) ?? ""} onChange={(e) => setModal({ ...modal, end_date: e.target.value })} />
                </div>
              </div>
              <div>
                <label htmlFor="mande-strategic-plan-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("correspondence.contacts.description")}</label>
                <textarea id="mande-strategic-plan-description" className="form-input min-h-[80px]" value={modal.description ?? ""} onChange={(e) => setModal({ ...modal, description: e.target.value })} />
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
