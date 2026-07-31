"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import api from "@/lib/api";

export default function MeIndicatorAggregationPage() {
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
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Indicator aggregation"
        subtitle="Advanced coverage dashboard with optional AI assist (human confirm required)."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Indicator aggregation" }]} />}
      />
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="card grid gap-3 p-4 md:grid-cols-4">
          <div><div className="text-xs text-neutral-500">Indicators</div><div className="text-2xl font-semibold">{data?.totals?.indicators ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">With targets</div><div className="text-2xl font-semibold">{data?.totals?.with_targets ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">With actuals</div><div className="text-2xl font-semibold">{data?.totals?.with_actuals ?? 0}</div></div>
          <div><div className="text-xs text-neutral-500">Coverage</div><div className="text-2xl font-semibold">{data?.totals?.coverage_pct ?? 0}%</div></div>
        </div>
      )}
      <div className="card space-y-3 p-4">
        <button type="button" className="btn-secondary text-sm" onClick={() => assist.mutate()} disabled={assist.isPending}>Generate AI draft</button>
        <textarea className="form-input min-h-40 w-full" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="AI draft appears here for human edit/confirm" />
        <button type="button" className="btn-primary text-sm" disabled={!draft || confirm.isPending} onClick={() => confirm.mutate()}>Confirm draft (no auto-submit)</button>
        {confirm.isSuccess && <p className="text-sm text-green-700">Draft confirmed for human use.</p>}
      </div>
    </div>
  );
}
