"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";

function QueuePage({ title, subtitle, queue }: { title: string; subtitle: string; queue: string }) {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelApi.list({ queue, per_page: 50 })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, [queue]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
      <p className="text-sm text-neutral-500">{subtitle}</p>
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Purpose</th>
              <th>Destination</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={4} className="py-8 text-center text-neutral-400">No pending items.</td></tr>
            ) : rows.map((t) => (
              <tr key={t.id}>
                <td><Link className="text-primary font-mono" href={`/travel/${t.id}`}>{t.reference_number}</Link></td>
                <td>{t.purpose}</td>
                <td>{[t.destination_city, t.destination_country].filter(Boolean).join(", ")}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function TravelAdminQueuePage() {
  return (
    <QueuePage
      title="Administration / Logistics Queue"
      subtitle="Travel requests awaiting administration review and logistics preparation."
      queue="admin"
    />
  );
}
