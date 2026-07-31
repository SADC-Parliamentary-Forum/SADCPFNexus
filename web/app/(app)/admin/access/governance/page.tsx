"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type Decision = { id: number; topic: string; status: string; decision_notes?: string };

export default function GovernanceChecklistPage() {
  const [rows, setRows] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ data: Decision[] }>("/admin/access/governance")
      .then((r) => r.data)
      .then((r) => setRows(r.data ?? []))
      .catch(() => setError("Failed to load governance checklist."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Governance checklist"
        subtitle="Institutional decisions (MFA policy, review cadence, break-glass) — pending until owners decide."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Admin", href: "/admin" },
              { label: "Access", href: "/admin/access" },
              { label: "Governance" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon="policy" title="No governance items" description="Checklist topics will appear once seeded by administrators." />
        </div>
      ) : (
        <div className="card divide-y divide-neutral-100">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900">{r.topic}</p>
                {r.decision_notes ? <p className="mt-0.5 text-xs text-neutral-500">{r.decision_notes}</p> : null}
              </div>
              <span className="badge badge-muted text-xs uppercase tracking-wide">{r.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
