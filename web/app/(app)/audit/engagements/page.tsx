"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AuditPageShell, AuditRowActions, AuditTable } from "@/components/audit/AuditChrome";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";

export default function AuditEngagementsPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["audit", "engagements"],
    queryFn: async () => (await auditApi.listEngagements({ per_page: 50 })).data,
  });
  const rows = (data as { data?: Array<Record<string, unknown>> })?.data ?? [];

  const create = useMutation({
    mutationFn: (engagementTitle: string) => auditApi.createEngagement({ title: engagementTitle }),
    onSuccess: () => {
      setTitle("");
      toast.success(t("audit.toast.engagementCreated"));
      qc.invalidateQueries({ queryKey: ["audit", "engagements"] });
    },
    onError: (err) => toast.error(t("audit.toast.engagementNotCreated"), apiErrorMessage(err, t("audit.toast.engagementFailed"))),
  });

  const runAction = (call: () => Promise<unknown>, successTitle: string, errorTitle: string) =>
    call()
      .then(() => {
        toast.success(successTitle);
        return qc.invalidateQueries({ queryKey: ["audit", "engagements"] });
      })
      .catch((err) => toast.error(errorTitle, apiErrorMessage(err, t("correspondence.detail.actionFailed"))));

  return (
    <AuditPageShell
      title="audit.engagements.title"
      subtitle="audit.engagements.subtitle"
      loading={isLoading}
      isEmpty={!isLoading && rows.length === 0}
      emptyTitle="audit.engagements.empty"
      actions={
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const engagementTitle = title.trim();
            if (!engagementTitle || create.isPending) return;
            create.mutate(engagementTitle);
          }}
        >
          <label htmlFor="audit-engagement-title" className="sr-only">{t("audit.engagements.placeholder")}</label>
          <input
            id="audit-engagement-title"
            className="form-input min-w-[12rem] flex-1 disabled:opacity-60"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("audit.engagements.placeholder")}
            disabled={create.isPending}
          />
          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={create.isPending || !title.trim()}
          >
            {create.isPending ? t("audit.engagements.creating") : t("audit.engagements.create")}
          </button>
        </form>
      }
    >
      <AuditTable columns={["audit.col.reference", "audit.col.title", "audit.col.status", "audit.col.actions"]}>
        {rows.map((r) => (
          <tr key={String(r.id)} className="border-b border-neutral-100">
            <td className="px-3 py-2.5">{String(r.reference_number ?? "—")}</td>
            <td className="px-3 py-2.5">
              <Link className="font-medium text-primary hover:text-primary/80" href={`/audit/engagements?id=${r.id}`}>
                {String(r.title)}
              </Link>
            </td>
            <td className="px-3 py-2.5 capitalize">{String(r.status)}</td>
            <td className="px-3 py-2.5">
              <AuditRowActions>
                <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.declareIndependence(Number(r.id), { status: "cleared" }), t("audit.toast.independenceCleared"), t("audit.toast.independenceNotCleared"))}>
                  {t("audit.engagements.clearIndependence")}
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.notifyEngagement(Number(r.id)), t("audit.toast.notificationSent"), t("audit.toast.notificationNotSent"))}>
                  {t("audit.engagements.notify")}
                </button>
                <button type="button" className="btn-secondary text-xs" onClick={() => runAction(() => auditApi.startFieldwork(Number(r.id)), t("audit.toast.fieldworkStarted"), t("audit.toast.fieldworkNotStarted"))}>
                  {t("audit.engagements.fieldwork")}
                </button>
              </AuditRowActions>
            </td>
          </tr>
        ))}
      </AuditTable>
    </AuditPageShell>
  );
}
