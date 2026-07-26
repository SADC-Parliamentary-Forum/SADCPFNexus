"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { travelApi } from "@/lib/api";

type Analytics = {
  by_status: Record<string, number>;
  cost_by_programme: { programme_id: number; programme_title?: string; programme_reference?: string; travel_count: number; dsa_total: number }[];
  cost_by_funding_agency: { funding_agency: string; amount_total: number; travel_count: number }[];
  totals: { requests: number; finance_dsa_total: number; estimated_dsa_total: number };
};

export default function TravelReportsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [pack, setPack] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      travelApi.analyticsSummary().then((r) => r.data.data),
      travelApi.reportsPack().then((r) => r.data.data).catch(() => null),
    ])
      .then(([analytics, reports]) => {
        setData(analytics);
        setPack(reports);
      })
      .catch(() => setError("Failed to load travel analytics."))
      .finally(() => setLoading(false));
  }, []);

  const packCount = (key: string) => (Array.isArray(pack?.[key]) ? (pack?.[key] as unknown[]).length : 0);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">Travel Reports &amp; Analytics</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Aggregates plus PRD report pack slices (register, retirement, TOIL, visa, amendments).
        </p>
      </div>

      <ul className="flex flex-wrap gap-4 text-sm">
        <li><Link className="text-primary" href="/travel/register">Travel Register / export</Link></li>
        <li><Link className="text-primary" href="/travel/missions">Mission readiness</Link></li>
        <li><Link className="text-primary" href="/travel/calendar">Travel calendar</Link></li>
        <li><Link className="text-primary" href="/reports">Institutional reports</Link></li>
      </ul>

      {loading && <p className="text-sm text-neutral-400">Loading analytics…</p>}
      {error && <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{error}</div>}

      {pack && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="travel-reports-pack">
            {[
              ["travel_register", "Register rows"],
              ["upcoming_travel", "Upcoming"],
              ["current_travellers", "Away now"],
              ["by_department", "By department"],
              ["by_programme", "By programme"],
              ["by_donor", "By donor"],
              ["dsa_summary", "DSA summary"],
              ["cancellations", "Cancellations"],
              ["outstanding_retirement", "Outstanding retirement"],
              ["toil_candidates", "TOIL candidates"],
              ["visa_status", "Visa watchlist"],
              ["amendments", "Amendments"],
            ].map(([key, label]) => (
              <div key={key} className="card p-4">
                <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
                <p className="text-2xl font-semibold mt-1">{packCount(key)}</p>
                <a
                  className="text-xs text-primary mt-2 inline-block"
                  href={travelApi.reportsPackExportUrl(key)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Download CSV
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" data-testid="travel-analytics-totals">
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Requests</p>
              <p className="text-2xl font-semibold mt-1">{data.totals.requests}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Finance DSA total</p>
              <p className="text-2xl font-semibold mt-1">{Number(data.totals.finance_dsa_total).toLocaleString()}</p>
            </div>
            <div className="card p-4">
              <p className="text-[11px] uppercase tracking-wide text-neutral-400">Estimated DSA total</p>
              <p className="text-2xl font-semibold mt-1">{Number(data.totals.estimated_dsa_total).toLocaleString()}</p>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">By status</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.by_status).map(([status, count]) => (
                <span key={status} className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs capitalize">
                  {status.replace(/_/g, " ")}: <strong>{count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Cost by programme</h2>
            <table className="data-table w-full text-sm">
              <thead>
                <tr><th>Programme</th><th>Travels</th><th>DSA total</th></tr>
              </thead>
              <tbody>
                {data.cost_by_programme.length === 0 ? (
                  <tr><td colSpan={3} className="text-neutral-400 py-4 text-center">No programme-linked travel yet.</td></tr>
                ) : data.cost_by_programme.map((row) => (
                  <tr key={row.programme_id}>
                    <td>{row.programme_reference ?? row.programme_title ?? row.programme_id}</td>
                    <td>{row.travel_count}</td>
                    <td>{Number(row.dsa_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-3">Cost by funding agency / donor</h2>
            <table className="data-table w-full text-sm">
              <thead>
                <tr><th>Funding agency</th><th>Travels</th><th>Amount</th></tr>
              </thead>
              <tbody>
                {data.cost_by_funding_agency.length === 0 ? (
                  <tr><td colSpan={3} className="text-neutral-400 py-4 text-center">No funding lines yet.</td></tr>
                ) : data.cost_by_funding_agency.map((row) => (
                  <tr key={row.funding_agency}>
                    <td>{row.funding_agency}</td>
                    <td>{row.travel_count}</td>
                    <td>{Number(row.amount_total).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
