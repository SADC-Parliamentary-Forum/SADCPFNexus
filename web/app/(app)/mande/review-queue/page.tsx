"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  submitted: "badge-warning",
  reviewed: "badge-primary",
  returned: "badge-danger",
  accepted: "badge-success",
};

export default function ReviewQueuePage() {
  const [filter, setFilter] = useState<"submitted" | "reviewed" | "both">("both");

  const { data: submitted = [], isLoading: loadingSubmitted, isError: errSubmitted } = useQuery({
    queryKey: ["mande", "review-queue", "submitted"],
    queryFn: () =>
      mandeApi.listReports({ review_status: "submitted", per_page: 100 }).then(
        (r) => r.data.data as MeActivityReport[]
      ),
    staleTime: 15_000,
  });

  const { data: reviewed = [], isLoading: loadingReviewed, isError: errReviewed } = useQuery({
    queryKey: ["mande", "review-queue", "reviewed"],
    queryFn: () =>
      mandeApi.listReports({ review_status: "reviewed", per_page: 100 }).then(
        (r) => r.data.data as MeActivityReport[]
      ),
    staleTime: 15_000,
  });

  const isLoading = loadingSubmitted || loadingReviewed;
  const isError = errSubmitted || errReviewed;

  let rows: MeActivityReport[] = [];
  if (filter === "submitted") rows = submitted;
  else if (filter === "reviewed") rows = reviewed;
  else rows = [...submitted, ...reviewed].sort((a, b) => {
    const ta = a.submitted_at ?? a.updated_at;
    const tb = b.submitted_at ?? b.updated_at;
    return tb.localeCompare(ta);
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="page-title">Review Queue</h1>
        <p className="page-subtitle">Activity reports awaiting M&amp;E review, return, accept or close.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            { value: "both", label: "Submitted + Reviewed" },
            { value: "submitted", label: "Submitted" },
            { value: "reviewed", label: "Reviewed" },
          ] as const
        ).map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`filter-tab ${filter === f.value ? "active" : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load review queue.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">rate_review</span>
            <p className="text-sm text-neutral-500">No reports in this queue.</p>
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
                <th>Submitted</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">{r.reference_number}</td>
                  <td className="font-medium text-neutral-900">{r.activity_title}</td>
                  <td className="text-xs text-neutral-500">{r.programme?.reference_number ?? "—"}</td>
                  <td className="text-xs text-neutral-500">{r.responsibleOfficer?.name ?? "—"}</td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[r.review_status] ?? "badge-muted"}`}>
                      {r.review_status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="text-xs text-neutral-400">
                    {r.submitted_at ? formatDateShort(r.submitted_at) : "—"}
                  </td>
                  <td>
                    <Link href={`/mande/activity-reports/${r.id}`} className="text-primary text-xs hover:underline">
                      Review
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
