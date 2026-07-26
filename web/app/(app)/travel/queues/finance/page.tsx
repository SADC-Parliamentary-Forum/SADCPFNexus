"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";

export default function TravelFinanceQueuePage() {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelApi.list({ queue: "finance", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Finance Review Queue (DSA)</h1>
      <p className="text-sm text-neutral-500">
        Finance Controller calculates authoritative DSA (Rate Types 1/2/3). Traveller estimates are not authoritative.
      </p>
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Purpose</th>
              <th>Est. DSA</th>
              <th>Finance status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No pending finance items.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id}>
                <td><Link className="text-primary font-mono" href={`/travel/${t.id}`}>{t.reference_number}</Link></td>
                <td>{t.purpose}</td>
                <td>{t.estimated_dsa} {t.currency}</td>
                <td>{t.finance_status ?? "awaiting"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
