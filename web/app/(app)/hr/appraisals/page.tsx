"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { appraisalApi, type Appraisal, type AppraisalCycle } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  employee_submitted: "Employee submitted",
  supervisor_reviewed: "Supervisor reviewed",
  hod_reviewed: "HOD reviewed",
  hr_reviewed: "HR reviewed",
  finalized: "Finalized",
};

const STATUS_CLS: Record<string, string> = {
  draft: "badge-muted",
  employee_submitted: "badge-warning",
  supervisor_reviewed: "badge-primary",
  hod_reviewed: "badge-primary",
  hr_reviewed: "badge-primary",
  finalized: "badge-success",
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
  const [search, setSearch] = useState("");
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

  const visible = list.filter((a) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    const hay = [a.employee?.name, a.cycle?.title, a.status].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  });

  const handleExport = () => {
    if (visible.length === 0) return;
    exportToCsv(
      `hr-appraisals-${new Date().toISOString().slice(0, 10)}.csv`,
      visible.map((a) => ({
        employee: a.employee?.name ?? "",
        cycle: a.cycle?.title ?? "",
        status: a.status,
        period_start: a.cycle?.period_start ?? "",
        period_end: a.cycle?.period_end ?? "",
      })),
      [
        { key: "employee", header: "Employee" },
        { key: "cycle", header: "Cycle" },
        { key: "status", header: "Status" },
        { key: "period_start", header: "Period start" },
        { key: "period_end", header: "Period end" },
      ],
    );
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/hr" className="hover:text-neutral-700 transition-colors">HR</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Appraisals</span>
          </div>
          <h1 className="page-title">Performance Appraisal</h1>
          <p className="page-subtitle">
            Formal review cycles, self-assessment, supervisor and HOD review, and SG decision. Completed appraisals are filed in the staff member&apos;s HR file.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary py-2 px-3 text-sm disabled:opacity-50"
            disabled={visible.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/hr/appraisals/new" className="btn-primary py-2 px-3 text-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New appraisal
          </Link>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
            search
          </span>
          <input
            type="search"
            className="form-input pl-10"
            placeholder="Search employee or cycle…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">Cycle</span>
        <select
          className="form-input max-w-[240px] py-2 text-sm"
          value={cycleFilter}
          onChange={(e) => {
            setCycleFilter(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
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
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-neutral-200">rate_review</span>
            <p className="mt-3 text-sm text-neutral-500">No appraisals found.</p>
            <p className="text-xs text-neutral-400 mt-1">
              {cycleFilter || statusFilter || search ? "Try changing the filters." : "Appraisals will appear here when created for a cycle."}
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
                  {visible.map((a) => (
                    <tr key={a.id}>
                      <td className="font-medium text-neutral-900">
                        {a.employee?.name ?? `#${a.employee_id}`}
                      </td>
                      <td className="text-neutral-600 text-sm">
                        {a.cycle?.title ?? `Cycle #${a.cycle_id}`}
                      </td>
                      <td>
                        <span className={`badge text-xs ${STATUS_CLS[a.status] ?? "badge-muted"}`}>
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
            <ListPagination
              page={page}
              lastPage={lastPage}
              total={total}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}
      </div>
    </div>
  );
}
