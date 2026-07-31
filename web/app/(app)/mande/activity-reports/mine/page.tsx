"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
};

export default function MyActivityReportsPage() {
  const user = getStoredUser();
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "activity-reports", "mine", search],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 50, mine: 1 };
      if (search.trim()) params.search = search.trim();
      return mandeApi.listReports(params).then((r) => r.data.data as MeActivityReport[]);
    },
    staleTime: 15_000,
    enabled: !!user?.id,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="My Reports"
        subtitle="Activity reports where you are the responsible officer or author."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "My Reports" }]} />}
      />
        <Link href="/mande/intake" className="btn-secondary flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">inbox</span>
          Intake
        </Link>
      </div>

      <div className="flex justify-end">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="form-input text-sm max-w-xs"
        />
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load your reports.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">assignment_ind</span>
            <p className="text-sm text-neutral-500">You have no activity reports yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Activity</th>
                <th>PIF</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {r.review_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-400">{formatDateShort(r.updated_at)}</td>
                  <td>
                    <Link href={`/mande/activity-reports/${r.id}`} className="text-primary text-xs hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
