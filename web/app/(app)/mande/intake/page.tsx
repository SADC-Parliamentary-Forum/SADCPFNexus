"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { mandeApi, type PifLinkage } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

export default function MandeIntakePage() {
  const qc = useQueryClient();
  const user = getStoredUser();
  const canReview = isSystemAdmin(user) || hasPermission(user, ["mande.review", "mande.admin"]);
  const [unlinkedOnly, setUnlinkedOnly] = useState(true);
  const [notReportableId, setNotReportableId] = useState<number | null>(null);
  const [reason, setReason] = useState("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "pif-linkages", unlinkedOnly],
    queryFn: () =>
      mandeApi.getPifLinkages(unlinkedOnly ? { unlinked: true } : undefined).then((r) => r.data.data as PifLinkage[]),
    staleTime: 20_000,
  });

  const notReportableMut = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) => mandeApi.markNotReportable(id, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mande", "pif-linkages"] });
      setNotReportableId(null);
      setReason("");
    },
  });

  const rows = data ?? [];

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Intake Queue"
        subtitle="Approved PIFs awaiting an M&amp;E activity report shell."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Intake Queue" }]} />}
      />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setUnlinkedOnly(true)}
            className={`filter-tab ${unlinkedOnly ? "active" : ""}`}
          >
            Unlinked
          </button>
          <button
            type="button"
            onClick={() => setUnlinkedOnly(false)}
            className={`filter-tab ${!unlinkedOnly ? "active" : ""}`}
          >
            All approved
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load intake queue.
        </div>
      )}

      <div className="card overflow-x-auto">
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300 block mb-2">inbox</span>
            <p className="text-sm text-neutral-500">
              {unlinkedOnly ? "No unlinked approved PIFs." : "No approved PIFs found."}
            </p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>PIF</th>
                <th>Title</th>
                <th>Pillar</th>
                <th>Dates</th>
                <th>Report</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td className="font-mono text-xs">{p.reference_number}</td>
                  <td className="font-medium text-neutral-900 max-w-sm">
                    <span className="line-clamp-2">{p.title}</span>
                  </td>
                  <td className="text-xs text-neutral-500">{p.strategic_pillar ?? "—"}</td>
                  <td className="text-xs text-neutral-500 whitespace-nowrap">
                    {p.start_date ? formatDateShort(p.start_date) : "—"}
                    {" → "}
                    {p.end_date ? formatDateShort(p.end_date) : "—"}
                  </td>
                  <td>
                    {p.has_report ? (
                      <span className="badge badge-success">Linked</span>
                    ) : (
                      <span className="badge badge-warning">Pending</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap">
                    {!p.has_report && (
                      <>
                        <Link
                          href={`/mande/activity-reports/create?programme_id=${p.id}`}
                          className="text-primary text-xs hover:underline mr-3"
                        >
                          Create report
                        </Link>
                        {canReview && (
                          <button
                            type="button"
                            onClick={() => {
                              setNotReportableId(p.id);
                              setReason("");
                            }}
                            className="text-neutral-500 text-xs hover:underline"
                          >
                            Not reportable
                          </button>
                        )}
                      </>
                    )}
                    {p.has_report && (
                      <Link href="/mande/activity-reports" className="text-primary text-xs hover:underline">
                        View reports
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {notReportableId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setNotReportableId(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-neutral-100">
              <h2 className="font-semibold text-neutral-800">Mark not reportable</h2>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-neutral-600">Provide a reason (min 5 characters). This creates/updates the M&amp;E shell as not reportable.</p>
              <textarea
                className="form-input min-h-[100px]"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Reason…"
              />
              {notReportableMut.isError && (
                <p className="text-xs text-red-600">Could not mark as not reportable.</p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-neutral-100 flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={() => setNotReportableId(null)}>Cancel</button>
              <button
                type="button"
                className="btn-primary disabled:opacity-40"
                disabled={reason.trim().length < 5 || notReportableMut.isPending}
                onClick={() => notReportableMut.mutate({ id: notReportableId, reason: reason.trim() })}
              >
                {notReportableMut.isPending ? "Saving…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
