"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";

type EvalRow = { id: number; reference_number: string; title: string; status: string };

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  open: "badge-primary",
  in_progress: "badge-warning",
  completed: "badge-success",
  closed: "badge-muted",
};

export default function MyWorkProcurementEvaluationsPage() {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [featureOnly, setFeatureOnly] = useState(false);

  useEffect(() => {
    api
      .get<{ data: EvalRow[]; meta?: { feature_only?: boolean } }>("/procurement/committee-evaluations")
      .then((r) => r.data)
      .then((res) => {
        setRows(res.data ?? []);
        setFeatureOnly(Boolean(res.meta?.feature_only));
      })
      .catch((e) => setError(e?.message ?? "You do not have access"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Procurement Evaluations"
        subtitle={
          featureOnly
            ? "Assigned evaluations only. Procurement module landing and sibling pages remain hidden."
            : "Assigned evaluations for your committee participation."
        }
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "My Work", href: "/my-work" },
              { label: "Procurement Evaluations" },
            ]}
          />
        }
        actions={
          !featureOnly ? (
            <Link href="/procurement/evaluations" className="btn-secondary text-sm">
              Full evaluations register
            </Link>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {featureOnly ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          Feature-only access — you only see evaluations assigned to you.
        </div>
      ) : null}

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : rows.length === 0 && !error ? (
        <div className="card">
          <EmptyState
            icon="gavel"
            title="No assigned evaluations"
            description="When you are added to a tender evaluation committee, items will appear here."
          />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Title</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="font-mono text-xs text-neutral-600">{r.reference_number}</td>
                    <td className="font-medium text-neutral-800">{r.title}</td>
                    <td>
                      <span className={`badge text-xs ${STATUS_BADGE[r.status] ?? "badge-muted"}`}>
                        {r.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="text-right">
                      <Link
                        href={`/procurement/evaluations?highlight=${r.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
