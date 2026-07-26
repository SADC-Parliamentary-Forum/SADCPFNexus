"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";

export default function TravelRegisterPage() {
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [exportRows, setExportRows] = useState<Record<string, unknown>[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    travelApi.list({ per_page: 100 })
      .then((r) => setRows(r.data.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Travel Register</h1>
          <p className="text-sm text-neutral-500">Approved and in-flight missions with DSA totals.</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-sm py-2 px-3"
          onClick={async () => {
            const res = await travelApi.registerExport();
            setExportRows(res.data.data);
          }}
        >
          Export CSV data
        </button>
      </div>
      {exportRows && (
        <pre className="text-xs bg-neutral-50 border rounded p-3 overflow-auto max-h-48">{JSON.stringify(exportRows, null, 2)}</pre>
      )}
      {loading ? <p className="text-sm text-neutral-400">Loading…</p> : (
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Purpose</th>
              <th>Dates</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id}>
                <td><Link className="text-primary font-mono" href={`/travel/${t.id}`}>{t.reference_number}</Link></td>
                <td>{t.purpose}</td>
                <td className="text-sm">{t.departure_date} → {t.return_date}</td>
                <td>{t.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
