"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelMission } from "@/lib/api";

export default function TravelMissionsPage() {
  const [rows, setRows] = useState<TravelMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    travelApi.listMissions({ per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .catch(() => setError("Failed to load missions."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Travel Mission Readiness</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Group readiness for travellers, tickets, visa, hotel, and Finance DSA.
        </p>
      </div>
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full" data-testid="travel-missions-table">
          <thead>
            <tr>
              <th>Mission</th>
              <th>Destination</th>
              <th>Dates</th>
              <th>Travellers</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No missions yet. Create via PIF send-to-travel.</td></tr>
            ) : rows.map((m) => (
              <tr key={m.id}>
                <td>
                  <Link className="text-primary font-medium" href={`/travel/missions/${m.id}`}>
                    {m.title}
                  </Link>
                </td>
                <td>{[m.destination_city, m.destination_country].filter(Boolean).join(", ") || "—"}</td>
                <td className="text-sm text-neutral-600">
                  {(m.start_date ?? "—").toString().slice(0, 10)} → {(m.end_date ?? "—").toString().slice(0, 10)}
                </td>
                <td>{m.requests_count ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
