"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { procurementPlansApi } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function PlanningPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading } = useQuery({
    queryKey: ["procurement", "plans"],
    queryFn: () => procurementPlansApi.list().then((r) => r.data.data),
  });

  const createMut = useMutation({
    mutationFn: () => procurementPlansApi.create({ plan_year: year, title }),
    onSuccess: () => {
      setTitle("");
      qc.invalidateQueries({ queryKey: ["procurement", "plans"] });
      toast.success(t("procurement.planning.created"));
    },
    onError: (err: unknown) => {
      toast.error(t("procurement.planning.notCreated"), apiErrorMessage(err, t("procurement.planning.createFailed")));
    },
  });

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("procurement.planning.title")}
        subtitle={t("procurement.planning.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("procurement.planning.title") }]} />}
      />

      <div className="card p-4 grid gap-3 sm:grid-cols-[120px_1fr_auto] items-end">
        <div>
          <label htmlFor="procurement-planning-year" className="block text-xs font-semibold mb-1">{t("procurement.planning.year")}</label>
          <input id="procurement-planning-year" type="number" className="form-input" value={year} onChange={(e) => setYear(Number(e.target.value))} />
        </div>
        <div>
          <label htmlFor="procurement-planning-title" className="block text-xs font-semibold mb-1">{t("procurement.planning.planTitle")}</label>
          <input id="procurement-planning-title" className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("procurement.planning.titlePlaceholder")} />
        </div>
        <button type="button" className="btn-primary" disabled={!title || createMut.isPending} onClick={() => createMut.mutate()}>
          {t("procurement.planning.create")}
        </button>
      </div>

      {isLoading ? (
        <div className="card p-8 text-center text-sm text-neutral-400">{t("common.loading")}</div>
      ) : (
        <div className="space-y-2">
          {(data ?? []).map((p) => (
            <div key={String(p.id)} className="card p-4 flex justify-between">
              <div>
                <p className="text-sm font-semibold">{String(p.title)}</p>
                <p className="text-xs text-neutral-500">{t("procurement.planning.meta", { year: String(p.plan_year), count: String(p.items_count ?? 0) })}</p>
              </div>
              <span className="text-xs uppercase">{String(p.status)}</span>
            </div>
          ))}
          {(data ?? []).length === 0 && (
            <div className="card">
              <EmptyState icon="calendar_month" title={t("procurement.planning.empty")} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
