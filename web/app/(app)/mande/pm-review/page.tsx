"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type MeActivityReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

export default function ProgrammeReviewQueuePage() {
  const qc = useQueryClient();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["mande", "pm-review-queue"],
    queryFn: () => mandeApi.listProgrammeReviewQueue().then((r) => r.data.data as MeActivityReport[]),
    staleTime: 10_000,
  });

  const clearMut = useMutation({
    mutationFn: (id: number) => mandeApi.clearProgrammeReview(id, { notes: notes[id] || undefined }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "pm-review-queue"] }),
  });

  const returnMut = useMutation({
    mutationFn: (id: number) =>
      mandeApi.returnProgrammeReview(id, { notes: notes[id] || "Returned by programme manager" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mande", "pm-review-queue"] }),
  });

  return (
    <div className="space-y-6 max-w-6xl">
      <ModulePageHeader
        title="Programme Manager Review"
        subtitle="Clear or return reports when programme manager review is enabled in M&amp;E settings."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Programme Manager Review" }]} />}
      />

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load programme review queue. You may need M&amp;E review permission.
        </div>
      )}

      {isLoading ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
      ) : data.length === 0 ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">
          No reports pending programme manager review.
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Title</th>
                <th>Status</th>
                <th>Submitted</th>
                <th>Notes / actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td className="font-mono text-xs">
                    <Link href={`/mande/activity-reports/${r.id}`} className="text-primary hover:underline">
                      {r.reference_number}
                    </Link>
                  </td>
                  <td className="text-sm">{r.activity_title}</td>
                  <td className="text-xs">{r.review_status}</td>
                  <td className="text-xs">{r.submitted_at ? formatDateShort(r.submitted_at) : "—"}</td>
                  <td className="space-y-2 min-w-[220px]">
                    <input
                      className="input text-xs w-full"
                      placeholder="Optional notes (required to return)"
                      value={notes[r.id] ?? ""}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-primary text-xs"
                        disabled={clearMut.isPending}
                        onClick={() => clearMut.mutate(r.id)}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        className="btn-secondary text-xs"
                        disabled={returnMut.isPending || !(notes[r.id]?.trim())}
                        onClick={() => returnMut.mutate(r.id)}
                      >
                        Return
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
