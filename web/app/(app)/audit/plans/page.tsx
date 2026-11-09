"use client";

import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell, AuditRowActions, AuditTable } from "@/components/audit/AuditChrome";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";

export default function AuditPlansPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "plans"],
    queryFn: async () => (await auditApi.listPlans({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: (planTitle: string) => auditApi.createPlan({ title: planTitle, fiscal_year: new Date().getFullYear() }),
    onSuccess: () => {
      setTitle("");
      toast.success(t("audit.toast.planCreated"));
      qc.invalidateQueries({ queryKey: ["audit", "plans"] });
    },
    onError: (err) => toast.error(t("audit.toast.planNotCreated"), apiErrorMessage(err, t("audit.toast.planFailed"))),
  });

  const runAction = (call: () => Promise<unknown>, successTitle: string, errorTitle: string) =>
    call()
      .then(() => {
        toast.success(successTitle);
        return qc.invalidateQueries({ queryKey: ["audit", "plans"] });
      })
      .catch((err) => toast.error(errorTitle, apiErrorMessage(err, t("correspondence.detail.actionFailed"))));

  return (
    <AuditPageShell
      title="audit.plans.title"
      subtitle="audit.plans.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.plans.empty"
      actions={
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const planTitle = title.trim();
            if (!planTitle || create.isPending) return;
            create.mutate(planTitle);
          }}
        >
          <label htmlFor="audit-plan-title" className="sr-only">{t("audit.plans.placeholder")}</label>
          <input
            id="audit-plan-title"
            className="form-input min-w-[12rem] flex-1 disabled:opacity-60"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("audit.plans.placeholder")}
            disabled={create.isPending}
          />
          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending ? t("audit.plans.creating") : t("audit.plans.create")}
          </button>
        </form>
      }
    >
      <AuditTable columns={["audit.col.title", "audit.col.year", "audit.col.version", "audit.col.status", "audit.col.actions"]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="border-b border-neutral-100">
            <td className="px-3 py-2.5">{String(r.title)}</td>
            <td className="px-3 py-2.5">{String(r.fiscal_year)}</td>
            <td className="px-3 py-2.5">v{String(r.version)}</td>
            <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
            <td className="px-3 py-2.5">
              <AuditRowActions>
                {r.status === "draft" || r.status === "amended" ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.submitPlan(Number(r.id)), t("audit.toast.planSubmitted"), t("audit.toast.planNotSubmitted"))}>
                    {t("audit.plans.submit")}
                  </button>
                ) : null}
                {r.status === "pending_approval" ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.approvePlan(Number(r.id)), t("audit.toast.planApproved"), t("audit.toast.planNotApproved"))}>
                    {t("audit.plans.approve")}
                  </button>
                ) : null}
                {r.status === "approved" ? (
                  <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.amendPlan(Number(r.id), { amendment_reason: "Scope change" }), t("audit.toast.planAmended"), t("audit.toast.planNotAmended"))}>
                    {t("audit.plans.amend")}
                  </button>
                ) : null}
              </AuditRowActions>
            </td>
          </tr>
        ))}
      </AuditTable>
    </AuditPageShell>
  );
}
