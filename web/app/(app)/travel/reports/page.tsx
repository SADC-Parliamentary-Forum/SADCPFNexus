"use client";

import Link from "next/link";

export default function TravelReportsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-semibold text-neutral-900">Travel Reports</h1>
      <p className="text-sm text-neutral-500">
        Phase 1: use the Travel Register export and institutional reports for status/DSA totals.
        Advanced analytics are deferred to Phase 2.
      </p>
      <ul className="space-y-2 text-sm">
        <li><Link className="text-primary" href="/travel/register">Travel Register / export</Link></li>
        <li><Link className="text-primary" href="/reports">Institutional reports (travel / DSA)</Link></li>
      </ul>
    </div>
  );
}
