"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import api from "@/lib/api";

export default function FleetUtilisationPage() {
  const [from, setFrom] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));

  const { data, isLoading, isError } = useQuery({
    queryKey: ["fleet-utilisation", from, to],
    queryFn: async () => (await api.get("/fleet/utilisation", { params: { from, to } })).data.data,
  });

  const vehicles = useMemo(() => (data?.vehicles ?? []) as Array<Record<string, unknown>>, [data]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="page-title">Fleet utilisation</h1>
        <p className="page-subtitle">Booking days, km travelled, and idle days by vehicle.</p>
      </div>
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
        <table className="min-w-full text-sm">
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
