"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { auditApi } from "@/lib/api";

export default function AuditDashboardPage() {
  const [view, setView] = useState<"auditor" | "management" | "sg">("auditor");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["audit", "dashboard", view],
    queryFn: async () => (await auditApi.dashboard(view)).data.data,
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">Audit Management</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Internal Audit assurance workspace — findings owned by Audit; corrective actions by Management.
          </p>
        </div>
        <div className="flex gap-2">
          {(["auditor", "management", "sg"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3 py-1.5 text-sm rounded border ${view === v ? "bg-neutral-900 text-white" : "bg-white"}`}
            >
              {v === "sg" ? "SG" : v[0].toUpperCase() + v.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && <p className="text-sm text-neutral-500">Loading dashboard…</p>}
      {isError && <p className="text-sm text-red-600">Unable to load dashboard.</p>}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Object.entries(data)
            .filter(([k]) => k !== "role")
            .map(([key, value]) => (
              <div key={key} className="border border-neutral-200 rounded-lg p-4 bg-white">
                <div className="text-xs uppercase tracking-wide text-neutral-500">{key.replaceAll("_", " ")}</div>
                <div className="text-2xl font-semibold mt-2">{String(value)}</div>
              </div>
            ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3 text-sm">
        <Link className="underline" href="/audit/analytics">Analytics</Link>
        <Link className="underline" href="/audit/universe">Universe</Link>
        <Link className="underline" href="/audit/plans">Plans</Link>
        <Link className="underline" href="/audit/engagements">Engagements</Link>
        <Link className="underline" href="/audit/findings">Findings</Link>
        <Link className="underline" href="/audit/corrective-actions">Corrective Actions</Link>
        <Link className="underline" href="/audit/campaigns">Campaigns</Link>
        <Link className="underline" href="/audit/resources">Resources</Link>
        <Link className="underline" href="/audit/qa">QA Reviews</Link>
        <Link className="underline" href="/audit/templates">Templates</Link>
        <Link className="underline" href="/audit/governance-packs">Governance Packs</Link>
        <Link className="underline" href="/audit/appointments">Appointments</Link>
        <Link className="underline" href="/audit/external">External Audit</Link>
        <Link className="underline" href="/audit/ai">AI Assist</Link>
        <Link className="underline" href="/audit/settings">Settings / Charter</Link>
      </div>
    </div>
  );
}
