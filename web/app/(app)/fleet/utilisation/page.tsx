"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";

export default function FleetUtilisationPage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fleet-utilisation", from, to],
    queryFn: async () => (await api.get("/fleet/utilisation", { params: { from, to } })).data.data,
  });

  const vehicles = useMemo(() => (data?.vehicles ?? []) as Array<Record<string, unknown>>, [data]);

  function exportRows() {
    exportToCsv(
      `fleet-utilisation-${from}-to-${to}.csv`,
      vehicles.map((v) => ({
        vehicle: `${v.asset_tag ?? ""} — ${v.name ?? ""}`,
        booking_days: v.booking_days,
        idle_days: v.idle_days,
        km_travelled: v.km_travelled,
        utilisation_pct: v.utilisation_pct,
      })),
      [
        { key: "vehicle", header: "Vehicle" },
        { key: "booking_days", header: "Booking days" },
        { key: "idle_days", header: "Idle days" },
        { key: "km_travelled", header: "Km" },
        { key: "utilisation_pct", header: "Util %" },
      ],
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <ModulePageHeader
        title="Fleet utilisation"
        subtitle="Booking days, km travelled, and idle days by vehicle."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Fleet utilisation" }]} />}
        actions={
          <button type="button" className="btn-secondary" onClick={exportRows} disabled={vehicles.length === 0}>
            Export CSV
          </button>
        }
      />
      <div className="flex flex-wrap gap-2">
        <input type="date" className="form-input" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="form-input" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>
      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {isError && <p className="text-sm text-red-700">Failed to load utilisation.</p>}
      {data && (
        <p className="text-sm text-neutral-600">Avg utilisation {data.summary?.avg_utilisation_pct}% · Total km {data.summary?.total_km}</p>
      )}
      <div className="card overflow-x-auto">
        <table className="data-table">
          <thead><tr className="text-left text-neutral-500"><th className="p-2">Vehicle</th><th className="p-2">Booking days</th><th className="p-2">Idle days</th><th className="p-2">Km</th><th className="p-2">Util %</th></tr></thead>
          <tbody>
            {vehicles.map((v) => (
              <tr key={String(v.asset_id)} className="border-t border-neutral-200">
                <td className="p-2">{String(v.asset_tag)} — {String(v.name)}</td>
                <td className="p-2">{String(v.booking_days)}</td>
                <td className="p-2">{String(v.idle_days)}</td>
                <td className="p-2">{String(v.km_travelled)}</td>
                <td className="p-2">{String(v.utilisation_pct)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
