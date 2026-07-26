"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";

export default function TravelDirectorFinanceQueuePage() {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelApi.list({ queue: "director-finance", per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Director Finance Queue</h1>
      <p className="text-sm text-neutral-500">Confirm funds availability after Finance DSA calculation.</p>
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Purpose</th>
              <th>DSA total</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No items awaiting Director Finance.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id}>
                <td><Link className="text-primary font-mono" href={`/travel/${t.id}`}>{t.reference_number}</Link></td>
                <td>{t.purpose}</td>
                <td>{t.finance_dsa_total ?? t.actual_dsa ?? "—"}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
