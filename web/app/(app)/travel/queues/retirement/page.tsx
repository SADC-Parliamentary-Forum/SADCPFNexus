"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";

export default function TravelRetirementQueuePage() {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelApi.list({ queue: "retirement", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Travel Retirement</h1>
      <p className="text-sm text-neutral-500">
        Mission report required within 5 working days of return. Linked imprest remains optional in Phase 1.
      </p>
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Purpose</th>
              <th>Retirement status</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No pending retirements.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id}>
                <td><Link className="text-primary font-mono" href={`/travel/${t.id}`}>{t.reference_number}</Link></td>
                <td>{t.purpose}</td>
                <td>{(t as TravelRequest & { retirement_status?: string }).retirement_status ?? "pending"}</td>
                <td>{(t as TravelRequest & { retirement_due_at?: string }).retirement_due_at ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
