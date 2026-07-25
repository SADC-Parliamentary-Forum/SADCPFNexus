"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport, type MeReviewStatus } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  not_submitted: "badge-muted",
  submitted: "badge-warning",
  returned: "badge-danger",
  reviewed: "badge-primary",
  accepted: "badge-success",
  closed: "badge-muted",
  not_reportable: "badge-muted",
  cancelled: "badge-danger",
};

const FILTERS: Array<{ value: string; label: string }> = [
  { value: "All", label: "All" },
  { value: "not_submitted", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "returned", label: "Returned" },
  { value: "reviewed", label: "Reviewed" },
  { value: "accepted", label: "Accepted" },
  { value: "closed", label: "Closed" },
];

export default function ActivityReportsPage() {
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "activity-reports", status, search],
    queryFn: () => {
      const params: Record<string, string | number> = { per_page: 50 };
      if (status !== "All") params.review_status = status;
      if (search.trim()) params.search = search.trim();
      return mandeApi.listReports(params).then((r) => r.data.data as MeActivityReport[]);
    },
    staleTime: 15_000,
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Activity Reports</h1>
          <p className="page-subtitle">All M&amp;E activity reports linked to approved PIFs.</p>
        </div>
        <Link href="/mande/intake" className="btn-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px]">inbox</span>
          Intake Queue
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setStatus(f.value)}
            className={`filter-tab ${status === f.value ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search title or reference…"
          className="ml-auto form-input text-sm max-w-xs"
        />
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load activity reports.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">description</span>
            <p className="text-sm text-neutral-500">No activity reports found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Activity</th>
                <th>PIF</th>
                <th>Officer</th>
                <th>Status</th>
                <th>Updated</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900 max-w-xs">
                    <span className="line-clamp-2">{r.activity_title}</span>
                  </td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{r.responsibleOfficer?.name ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {String(r.review_status as MeReviewStatus).replace(/_/g, " ")}
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
