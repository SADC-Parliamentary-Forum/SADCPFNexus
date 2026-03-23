"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { appraisalApi, type Appraisal, type AppraisalCycle } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  employee_submitted: "Employee submitted",
  supervisor_reviewed: "Supervisor reviewed",
  hod_reviewed: "HOD reviewed",
  hr_reviewed: "HR reviewed",
  finalized: "Finalized",
};

const STATUS_CLS: Record<string, string> = {
  draft: "bg-neutral-100 text-neutral-700 border-neutral-200",
  employee_submitted: "bg-amber-100 text-amber-800 border-amber-200",
  supervisor_reviewed: "bg-blue-100 text-blue-800 border-blue-200",
  hod_reviewed: "bg-indigo-100 text-indigo-800 border-indigo-200",
  hr_reviewed: "bg-purple-100 text-purple-800 border-purple-200",
  finalized: "bg-green-100 text-green-800 border-green-200",
};

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function AppraisalsPage() {
  const [cycles, setCycles] = useState<AppraisalCycle[]>([]);
  const [list, setList] = useState<Appraisal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cycleFilter, setCycleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const loadCycles = useCallback(async () => {
    try {
      const res = await appraisalApi.cycles();
      setCycles(Array.isArray(res.data) ? res.data : []);
    } catch {
      setCycles([]);
    }
  }, []);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { per_page: number; page: number; cycle_id?: number; status?: string } = {
        per_page: 20,
        page,
      };
      if (cycleFilter) params.cycle_id = Number(cycleFilter);
      if (statusFilter) params.status = statusFilter;
      const res = await appraisalApi.list(params);
      const payload = res.data as { data?: Appraisal[]; current_page?: number; last_page?: number; total?: number };
      setList(payload.data ?? []);
      setLastPage(payload.last_page ?? 1);
      setTotal(payload.total ?? 0);
    } catch {
      setError("Failed to load appraisals.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, [page, cycleFilter, statusFilter]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            HR
          </Link>
          <h1 className="page-title">Performance Appraisal</h1>
          <p className="page-subtitle">
            Formal review cycles, self-assessment, supervisor and HOD review, and SG decision. Completed appraisals are filed in the staff member&apos;s HR file.
          </p>
        </div>
        <Link href="/hr/appraisals/new" className="btn-primary py-2 px-3 text-sm flex items-center gap-1">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New appraisal
        </Link>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cycle</span>
        <select
          className="form-input max-w-[240px] py-2 text-sm"
          value={cycleFilter}
          onChange={(e) => setCycleFilter(e.target.value)}
        >
          <option value="">All cycles</option>
          {cycles.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.title} ({formatDate(c.period_start)} – {formatDate(c.period_end)})
            </option>
          ))}
        </select>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Status</span>
        <select
          className="form-input max-w-[200px] py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="card overflow-hidden">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-neutral-900">Appraisals</h3>
          <Link href="/hr" className="text-xs font-semibold text-primary hover:underline">
            Back to HR
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">rate_review</span>
            <p className="mt-3 text-sm text-neutral-500">No appraisals found.</p>
            <p className="text-xs text-neutral-400 mt-1">
              {cycleFilter || statusFilter ? "Try changing the filters." : "Appraisals will appear here when created for a cycle."}
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Cycle</th>
                    <th>Status</th>
                    <th>Period</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-neutral-900">
                        {a.employee?.name ?? `#${a.employee_id}`}
                      </td>
                      <td className="text-neutral-600 text-sm">
                        {a.cycle?.title ?? `Cycle #${a.cycle_id}`}
                      </td>
                      <td>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLS[a.status] ?? "bg-neutral-100"}`}>
                          {STATUS_LABELS[a.status] ?? a.status}
                        </span>
                      </td>
                      <td className="text-sm text-neutral-600 whitespace-nowrap">
                        {a.cycle ? `${formatDate(a.cycle.period_start)} – ${formatDate(a.cycle.period_end)}` : "—"}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/hr/appraisals/${a.id}`}
                          className="text-sm font-semibold text-primary hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {lastPage > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 text-sm text-neutral-600">
                <span>Page {page} of {lastPage} ({total} total)</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= lastPage}
                    onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                    className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
