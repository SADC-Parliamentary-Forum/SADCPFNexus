"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

type ToilCredit = {
  id: number;
  credit_reference?: string;
  remaining_balance?: number;
  expiry_date?: string;
  days_until_expiry?: number;
  status?: string;
};

export default function LeaveToilPage() {
  const [credits, setCredits] = useState<ToilCredit[]>([]);

  useEffect(() => {
    api.get<{ data: ToilCredit[] }>("/leave/toil")
      .then((r) => {
        const body = r.data as { data?: ToilCredit[] };
        setCredits(Array.isArray(body.data) ? body.data : []);
      })
      .catch(() => setCredits([]));
  }, []);

  const expiring = credits.filter((c) => typeof c.days_until_expiry === "number" && c.days_until_expiry <= 30);

  return (
    <div className="page-container space-y-4">
      <div className="page-header flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-title">TOIL / Leave-in-Lieu Credits</h1>
          <p className="page-subtitle">Expiry monitoring — daily job expires overdue credits at 08:20.</p>
        </div>
        <Link href="/leave/queues/certify" className="btn btn-secondary btn-sm">Certification queue</Link>
      </div>

      {expiring.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {expiring.length} credit(s) expire within 30 days.
        </div>
      )}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Balance (days)</th>
              <th>Expires</th>
              <th>Days left</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {credits.map((c) => (
              <tr key={c.id} className={typeof c.days_until_expiry === "number" && c.days_until_expiry <= 14 ? "bg-amber-50" : undefined}>
                <td>{c.credit_reference ?? c.id}</td>
                <td>{c.remaining_balance ?? "—"}</td>
                <td>{c.expiry_date ?? "—"}</td>
                <td>{c.days_until_expiry ?? "—"}</td>
                <td>{c.status ?? "—"}</td>
              </tr>
            ))}
            {credits.length === 0 && <tr><td colSpan={5}>No TOIL credits.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
