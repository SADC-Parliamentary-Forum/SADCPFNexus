"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tenderCommitteesApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function TenderCommitteePage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "tender-committees"],
    queryFn: () => tenderCommitteesApi.list().then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => tenderCommitteesApi.create({ name, quorum_minimum: 3 }),
    onSuccess: () => {
      setName("");
      qc.invalidateQueries({ queryKey: ["procurement", "tender-committees"] });
      toast.success(t("procurement.tenderCommittee.created"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.tenderCommittee.notCreated"), apiErrorMessage(err, t("procurement.tenderCommittee.createFailed")));
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("procurement.tenderCommittee.title")}
        subtitle={t("procurement.tenderCommittee.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("procurement.tenderCommittee.title") }]} />}
      />

      <div className="card p-4 flex gap-2 items-end">
        <div className="flex-1">
          <label htmlFor="procurement-tender-committee-new-committee" className="block text-xs font-semibold mb-1">{t("procurement.tenderCommittee.newCommittee")}</label>
          <input id="procurement-tender-committee-new-committee" className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("procurement.tenderCommittee.namePlaceholder")} />
        </div>
        <button type="button" className="btn-primary" disabled={!name || createMut.isPending} onClick={() => createMut.mutate()}>
          {t("common.create")}
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((c) => (
            <div key={String(c.id)} className="card p-4">
              <p className="text-sm font-semibold">{String(c.name)}</p>
              <p className="text-xs text-neutral-500">{t("procurement.tenderCommittee.meta", { quorum: String(c.quorum_minimum ?? 3), members: Array.isArray(c.members) ? c.members.length : 0 })}</p>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <div className="card">
              <EmptyState icon="groups" title={t("procurement.tenderCommittee.empty")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
