"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateShort } from "@/lib/utils";

type LeaveRow = {
  id: number;
  reference_number: string;
  status: string;
  leave_type: string;
  start_date: string;
  end_date: string;
  current_stage?: string;
  current_holder?: string;
  recommendation_status?: string;
  requester?: { id: number; name: string };
};

const TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  lil: "Leave in Lieu",
  special: "Special",
  maternity: "Maternity",
  paternity: "Paternity",
};

export default function LeaveCertificationQueuePage() {
  const [rows, setRows] = useState<LeaveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get<{ data: LeaveRow[] }>("/leave/requests", {
        params: { queue: "certify", per_page: 50 },
      });
      const body = r.data as { data?: LeaveRow[] };
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch {
      setRows([]);
      setError("Failed to load certification queue.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function certify(id: number) {
    setBusyId(id);
    setError(null);
    try {
      await api.post(`/leave/requests/${id}/certify`, {
        action: "certify",
        comment: "Certified from queue",
      });
      setToast(`Leave request #${id} certified.`);
      window.setTimeout(() => setToast(null), 3200);
      await load();
    } catch {
      setError("Failed to certify request. You may lack HR certification permission.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <ModulePageHeader
        title="Leave Certification Queue"
        subtitle="Recommended requests awaiting Administration / HR certification."
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "Leave", href: "/leave" }, { label: "Certification queue" }]} />
        }
        actions={
          <>
            <Link href="/leave" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">list</span>
              Leave register
            </Link>
            <Link href="/leave/toil" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">schedule</span>
              TOIL credits
            </Link>
          </>
        }
      />

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{toast}</div>
      )}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-6">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon="fact_check"
            title="No requests awaiting certification"
            description="Items appear here after HOD recommendation."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Stage</th>
                  <th>Holder</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/leave/${r.id}`} className="font-mono text-xs font-medium text-primary hover:underline">
                        {r.reference_number}
                      </Link>
                    </td>
                    <td className="font-medium text-neutral-900">{r.requester?.name ?? "—"}</td>
                    <td className="text-sm text-neutral-700">{TYPE_LABELS[r.leave_type] ?? r.leave_type}</td>
                    <td className="whitespace-nowrap text-xs text-neutral-600">
                      {formatDateShort(r.start_date)} → {formatDateShort(r.end_date)}
                    </td>
                    <td className="text-sm text-neutral-600">{r.current_stage ?? "Certification"}</td>
                    <td className="text-sm text-neutral-600">{r.current_holder ?? "HR / Admin"}</td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/leave/${r.id}`} className="text-xs font-medium text-neutral-600 hover:underline">
                          View
                        </Link>
                        <button
                          type="button"
                          className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
                          disabled={busyId === r.id}
                          onClick={() => void certify(r.id)}
                        >
                          {busyId === r.id ? "Certifying…" : "Certify"}
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
    </div>
  );
}
