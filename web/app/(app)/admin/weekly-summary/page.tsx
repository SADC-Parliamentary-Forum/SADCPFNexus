"use client";

import { useEffect, useState, useCallback } from "react";
import { weeklySummaryApi, WeeklySummaryRun } from "@/lib/api";
import { formatDate, formatDateRelative } from "@/lib/utils";

const STATUS_BADGE: Record<string, string> = {
  running:   "badge-warning",
  completed: "badge-success",
  partial:   "badge-warning",
  failed:    "badge-danger",
  pending:   "badge-muted",
};

export default function AdminWeeklySummaryPage() {
  const [runs, setRuns]         = useState<WeeklySummaryRun[]>([]);
  const [loading, setLoading]   = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast]       = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [page, setPage]         = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [polling, setPolling]   = useState(false);

  const showToast = (type: "success" | "error", text: string) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRuns = useCallback(async (p = page) => {
    try {
      const res = await weeklySummaryApi.listRuns({ page: p });
      const body = res.data as any;
      setRuns(body.data ?? []);
      setLastPage(body.last_page ?? 1);
    } catch {
      // silently fail on background polls
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    loadRuns();
  }, [loadRuns]);

  // Poll every 10 s while a run is in progress
  useEffect(() => {
    const hasRunning = runs.some((r) => r.status === "running");
    if (hasRunning && !polling) {
      setPolling(true);
      const id = setInterval(() => loadRuns(), 10_000);
      return () => { clearInterval(id); setPolling(false); };
    }
  }, [runs, polling, loadRuns]);

  const handleTrigger = async () => {
    setTriggering(true);
    try {
      await weeklySummaryApi.triggerRun();
      showToast("success", "Weekly summary run queued. Refresh in a few moments.");
      setTimeout(() => loadRuns(), 2000);
    } catch {
      showToast("error", "Failed to queue run. Check your permissions.");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium text-white ${toast.type === "success" ? "bg-green-600" : "bg-red-600"}`}>
          {toast.text}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Weekly Summary</h1>
          <p className="page-subtitle">Trigger and monitor institutional summary email batches</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => loadRuns()} className="btn-secondary flex items-center gap-1">
            <span className="material-symbols-outlined text-base">refresh</span>
            Refresh
          </button>
          <button
            onClick={handleTrigger}
            disabled={triggering}
            className="btn-primary flex items-center gap-1 disabled:opacity-60"
          >
            {triggering ? (
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-base">send</span>
            )}
            {triggering ? "Queuing…" : "Trigger Run"}
          </button>
        </div>
      </div>

      {/* Stats row (from latest run) */}
      {runs.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Users",     value: runs[0].total_users,     icon: "group" },
            { label: "Generated",       value: runs[0].total_generated, icon: "description" },
            { label: "Sent",            value: runs[0].total_sent,      icon: "mark_email_read" },
            { label: "Failed",          value: runs[0].total_failed,    icon: "error", warn: runs[0].total_failed > 0 },
          ].map((s) => (
            <div key={s.label} className={`card p-4 text-center ${s.warn ? "border-red-200" : ""}`}>
              <span className={`material-symbols-outlined text-2xl ${s.warn ? "text-red-500" : "text-primary"}`}>{s.icon}</span>
              <div className={`text-3xl font-bold mt-1 ${s.warn ? "text-red-600" : "text-neutral-900"}`}>{s.value}</div>
              <div className="text-xs text-neutral-500 mt-1">{s.label} (latest run)</div>
            </div>
          ))}
        </div>
      )}

      {/* Run history table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-200 flex items-center gap-2">
          <span className="material-symbols-outlined text-neutral-500">history</span>
          <h2 className="font-semibold text-neutral-800">Run History</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-neutral-400">Loading…</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-neutral-400">No runs yet. Trigger the first one above.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Status</th>
                <th>Users</th>
                <th>Generated</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Started</th>
                <th>Completed</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id}>
                  <td className="font-medium">
                    {formatDate(run.period_start)} – {formatDate(run.period_end)}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[run.status] ?? "badge-muted"}`}>
                      {run.status}
                    </span>
                  </td>
                  <td>{run.total_users}</td>
                  <td>{run.total_generated}</td>
                  <td>{run.total_sent}</td>
                  <td className={run.total_failed > 0 ? "text-red-600 font-semibold" : ""}>{run.total_failed}</td>
                  <td className="text-neutral-500 text-xs">{run.started_at ? formatDateRelative(run.started_at) : "—"}</td>
                  <td className="text-neutral-500 text-xs">{run.completed_at ? formatDateRelative(run.completed_at) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {lastPage > 1 && (
          <div className="px-5 py-3 border-t border-neutral-100 flex gap-2 justify-end">
            <button
              onClick={() => { setPage(p => Math.max(1, p - 1)); loadRuns(Math.max(1, page - 1)); }}
              disabled={page <= 1}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
            >Prev</button>
            <span className="text-sm text-neutral-500 self-center">Page {page} / {lastPage}</span>
            <button
              onClick={() => { setPage(p => Math.min(lastPage, p + 1)); loadRuns(Math.min(lastPage, page + 1)); }}
              disabled={page >= lastPage}
              className="btn-secondary text-sm px-3 py-1.5 disabled:opacity-40"
            >Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
