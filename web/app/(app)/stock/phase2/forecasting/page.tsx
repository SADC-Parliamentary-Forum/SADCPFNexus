"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { stockDemandApi, type StockDemandRow } from "@/lib/api";

export default function StockDemandForecastPage() {
  const [lookback, setLookback] = useState(90);
  const query = useQuery({
    queryKey: ["stock", "demand-forecast", lookback],
    queryFn: () => stockDemandApi.forecast({ lookback_days: lookback }).then((r) => r.data),
  });

  const rows = (query.data?.data ?? []) as StockDemandRow[];
  const method = query.data?.meta?.method ?? "exponential_smoothing";
  const needs = rows.filter((r) => r.needs_reorder);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <ModulePageHeader
        title="Demand / reorder suggestions"
        subtitle="Exponential smoothing of stock issues over the lookback window, with optional HTTP ML overlay. Not a live ML model unless STOCK_FORECAST_HTTP_URL is set."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Demand / reorder suggestions" }]} />}
      />
        <div className="flex items-center gap-2">
          <label className="text-sm text-neutral-600">Lookback days</label>
          <select className="form-input w-28" value={lookback} onChange={(e) => setLookback(Number(e.target.value))}>
            <option value={30}>30</option>
            <option value={60}>60</option>
            <option value={90}>90</option>
            <option value={180}>180</option>
          </select>
        </div>
      </div>

      <div className="card p-4 text-sm text-neutral-700">
        {needs.length} item{needs.length === 1 ? "" : "s"} suggested for reorder (of {rows.length} active).
        Method: {method}.
      </div>

      <div className="card overflow-x-auto p-4">
        {query.isLoading && <p className="text-sm text-neutral-500">Loading usage…</p>}
        {query.isError && <p className="text-sm text-red-700">Failed to load demand forecast.</p>}
        {!query.isLoading && !query.isError && (
          <table className="min-w-full text-sm">
            <thead className="text-left text-neutral-500">
              <tr>
                <th className="py-2 pr-3">Item</th>
                <th className="py-2 pr-3">Available</th>
                <th className="py-2 pr-3">Usage</th>
                <th className="py-2 pr-3">Avg/day</th>
                <th className="py-2 pr-3">Days cover</th>
                <th className="py-2 pr-3">Suggested reorder</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.stock_item_id} className={`border-t border-[var(--border)] ${r.needs_reorder ? "bg-amber-50/60" : ""}`}>
                  <td className="py-2 pr-3">
                    <div className="font-medium">{r.item_code}</div>
                    <div className="text-neutral-500">{r.name}{r.unit ? ` · ${r.unit}` : ""}</div>
                  </td>
                  <td className="py-2 pr-3 tabular-nums">{r.available_quantity}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.usage_qty}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.avg_daily_usage}</td>
                  <td className="py-2 pr-3 tabular-nums">{r.days_of_cover ?? "—"}</td>
                  <td className="py-2 pr-3 font-semibold tabular-nums">{r.suggested_reorder_qty || "—"}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="py-6 text-neutral-400">No stock items.</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
