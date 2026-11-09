"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const FIELD_LABELS: Record<string, string> = {
  base_currency: "budget.fx.baseCurrency",
  quote_currency: "budget.fx.quoteCurrency",
  rate: "budget.fx.rate",
  effective_date: "budget.fx.effectiveDate",
};

export default function BudgetFxRatesPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { error: toastError } = useToast();
  const [form, setForm] = useState({ base_currency: "USD", quote_currency: "NAD", rate: "", effective_date: new Date().toISOString().slice(0, 10) });
  const [convert, setConvert] = useState({ amount: "1", from: "USD", to: "NAD" });
  const [convertResult, setConvertResult] = useState<Record<string, unknown> | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["budget-fx-rates"],
    queryFn: async () => (await api.get("/budget/fx-rates")).data,
  });

  const save = useMutation({
    mutationFn: () => api.post("/budget/fx-rates", { ...form, rate: Number(form.rate) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["budget-fx-rates"] }),
    onError: () => toastError(t("budget.fx.addFailed"), t("budget.checkValues")),
  });

  const doConvert = useMutation({
    mutationFn: async () => (await api.post("/budget/fx-rates/convert", { ...convert, amount: Number(convert.amount) })).data.data,
    onSuccess: (d) => setConvertResult(d),
    onError: () => toastError(t("budget.fx.convertFailed"), t("budget.fx.convertFailedHint")),
  });

  const rows = (data?.data ?? data?.data?.data ?? []) as Array<Record<string, unknown>>;
  const list = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? data?.data ?? []);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="budget.fx.title"
        subtitle="budget.fx.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "budget.fx.title" }]} />}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        {(["base_currency", "quote_currency", "rate", "effective_date"] as const).map((k) => (
          <label key={k} className="block space-y-1" htmlFor={`fx-rate-${k}`}>
            <span className="text-xs font-medium text-neutral-700">{t(FIELD_LABELS[k])}</span>
            <input
              id={`fx-rate-${k}`}
              className="form-input w-full"
              type={k === "effective_date" ? "date" : k === "rate" ? "number" : "text"}
              min={k === "rate" ? "0" : undefined}
              step={k === "rate" ? "0.0001" : undefined}
              placeholder={k === "rate" ? t("budget.fx.ratePlaceholder") : t(FIELD_LABELS[k])}
              value={(form as any)[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </label>
        ))}
        <div className="flex items-end">
          <button type="button" className="btn-primary" onClick={() => save.mutate()} disabled={!form.rate || save.isPending}>
            {save.isPending ? t("budget.adding") : t("budget.fx.add")}
          </button>
        </div>
      </div>
      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <input className="form-input" value={convert.amount} onChange={(e) => setConvert({ ...convert, amount: e.target.value })} placeholder={t("budget.amount")} aria-label={t("budget.amount")} />
        <input className="form-input" value={convert.from} onChange={(e) => setConvert({ ...convert, from: e.target.value.toUpperCase() })} placeholder={t("budget.fx.from")} aria-label={t("budget.fx.from")} />
        <input className="form-input" value={convert.to} onChange={(e) => setConvert({ ...convert, to: e.target.value.toUpperCase() })} placeholder={t("budget.fx.to")} aria-label={t("budget.fx.to")} />
        <button type="button" className="btn-secondary" onClick={() => doConvert.mutate()}>{t("budget.fx.convert")}</button>
        {convertResult && <p className="md:col-span-4 text-sm">{t("budget.fx.converted", { amount: String(convertResult.converted), currency: String(convertResult.to), rate: String(convertResult.rate) })}</p>}
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">{t("common.loading")}</p> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-2">{t("budget.fx.pair")}</th><th className="p-2">{t("budget.fx.rate")}</th><th className="p-2">{t("budget.fx.effective")}</th><th className="p-2">{t("budget.fx.source")}</th></tr></thead>
            <tbody>
              {(Array.isArray(list) ? list : rows).map((r: any) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="p-2">{r.base_currency}/{r.quote_currency}</td>
                  <td className="p-2">{r.rate}</td>
                  <td className="p-2">{String(r.effective_date).slice(0, 10)}</td>
                  <td className="p-2">{r.source}</td>
                </tr>
              ))}
              {(Array.isArray(list) ? list : rows).length === 0 && (
                <TableEmpty colSpan={4} title={t("budget.fx.empty")} />
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
