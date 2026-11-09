"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MeIndicatorAggregationPage() {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["me-indicator-aggregation"],
    queryFn: async () => (await api.get("/mande/indicators/aggregation")).data.data,
  });

  const assist = useMutation({
    mutationFn: async () => (await api.post("/mande/ai-assist", { scope: "indicator_summary", context: data?.totals ?? {} })).data.data,
    onSuccess: (d) => setDraft(d.draft ?? ""),
  });

  const confirm = useMutation({
    mutationFn: async () => (await api.post("/mande/ai-assist/confirm", { draft })).data.data,
  });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("mande.aggregation.title")}
        subtitle={t("mande.aggregation.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.aggregation.title") }]} />}
      />
      {isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : (
        <div className="card grid gap-3 p-4 md:grid-cols-4">
          <div><div className="text-xs text-neutral-500">{t("mande.aggregation.indicators")}</div><div className="text-2xl font-semibold">{data?.totals?.indicators ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">{t("mande.aggregation.withTargets")}</div><div className="text-2xl font-semibold">{data?.totals?.with_targets ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">{t("mande.aggregation.withActuals")}</div><div className="text-2xl font-semibold">{data?.totals?.with_actuals ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">{t("mande.aggregation.coverage")}</div><div className="text-2xl font-semibold">{data?.totals?.coverage_pct ?? 0}%</div></div>
        </div>
      )}
      <div className="card space-y-3 p-4">
        <button type="button" className="btn-secondary text-sm" onClick={() => assist.mutate()} disabled={assist.isPending}>{t("mande.aggregation.generate")}</button>
        <textarea className="form-input min-h-40 w-full" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t("mande.aggregation.placeholder")} />
        <button type="button" className="btn-primary text-sm" disabled={!draft || confirm.isPending} onClick={() => confirm.mutate()}>{t("mande.aggregation.confirm")}</button>
        {confirm.isSuccess && <p className="text-sm text-green-700">{t("mande.aggregation.confirmed")}</p>}
      </div>
    </div>
  );
}
