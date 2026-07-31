"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/api";

export default function BudgetFxRatesPage() {
  const qc = useQueryClient();
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
  });

  const doConvert = useMutation({
    mutationFn: async () => (await api.post("/budget/fx-rates/convert", { ...convert, amount: Number(convert.amount) })).data.data,
    onSuccess: (d) => setConvertResult(d),
  });

  const rows = (data?.data ?? data?.data?.data ?? []) as Array<Record<string, unknown>>;
  const list = Array.isArray(data?.data) ? data.data : (data?.data?.data ?? data?.data ?? []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Budget FX rates"
        subtitle="Multi-currency conversion for cashflow/reports. No bank or GL posting."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Budget FX rates" }]} />}
      />
      <div className="card grid gap-3 p-4 md:grid-cols-5">
        {(["base_currency", "quote_currency", "rate", "effective_date"] as const).map((k) => (
          <input key={k} className="form-input" placeholder={k} value={(form as any)[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
        ))}
        <button type="button" className="btn-primary" onClick={() => save.mutate()} disabled={!form.rate || save.isPending}>Add rate</button>
      </div>
      <div className="card grid gap-3 p-4 md:grid-cols-4">
        <input className="form-input" value={convert.amount} onChange={(e) => setConvert({ ...convert, amount: e.target.value })} placeholder="Amount" />
        <input className="form-input" value={convert.from} onChange={(e) => setConvert({ ...convert, from: e.target.value.toUpperCase() })} placeholder="From" />
        <input className="form-input" value={convert.to} onChange={(e) => setConvert({ ...convert, to: e.target.value.toUpperCase() })} placeholder="To" />
        <button type="button" className="btn-secondary" onClick={() => doConvert.mutate()}>Convert</button>
        {convertResult && <p className="md:col-span-4 text-sm">Converted: <strong>{String(convertResult.converted)}</strong> {String(convertResult.to)} (rate {String(convertResult.rate)})</p>}
      </div>
      {isLoading ? <p className="text-sm text-neutral-500">Loading…</p> : (
        <div className="card overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-2">Pair</th><th className="p-2">Rate</th><th className="p-2">Effective</th><th className="p-2">Source</th></tr></thead>
            <tbody>
              {(Array.isArray(list) ? list : rows).map((r: any) => (
                <tr key={r.id} className="border-t border-neutral-200">
                  <td className="p-2">{r.base_currency}/{r.quote_currency}</td>
                  <td className="p-2">{r.rate}</td>
                  <td className="p-2">{String(r.effective_date).slice(0, 10)}</td>
                  <td className="p-2">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
