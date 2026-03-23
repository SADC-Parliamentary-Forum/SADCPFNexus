"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";

const STATUS_LABELS: Record<string, string> = {
  excellent: "Excellent",
  strong: "Strong",
  satisfactory: "Satisfactory",
  watchlist: "Watchlist",
  at_risk: "At Risk",
  critical_review_required: "Critical Review Required",
};

const STATUS_CLS: Record<string, string> = {
  excellent: "bg-green-100 text-green-800 border-green-200",
  strong: "bg-primary/10 text-primary border-primary/20",
  satisfactory: "bg-neutral-100 text-neutral-700 border-neutral-200",
  watchlist: "bg-amber-100 text-amber-800 border-amber-200",
  at_risk: "bg-orange-100 text-orange-800 border-orange-200",
  critical_review_required: "bg-red-100 text-red-800 border-red-200",
};

const TREND_LABELS: Record<string, string> = {
  improving: "Improving",
  stable: "Stable",
  declining: "Declining",
  inconsistent: "Inconsistent",
  insufficient_data: "Insufficient Data",
};

const DIMENSIONS = [
  { key: "output_score", label: "Output" },
  { key: "timeliness_score", label: "Timeliness" },
  { key: "quality_score", label: "Quality" },
  { key: "workload_score", label: "Workload" },
  { key: "update_compliance_score", label: "Update compliance" },
  { key: "development_progress_score", label: "Development progress" },
] as const;

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PerformanceProfilePage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id != null ? Number(params.id) : NaN;
  const [tracker, setTracker] = useState<PerformanceTracker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supervisorSummary, setSupervisorSummary] = useState("");
  const [hrSummary, setHrSummary] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      router.replace("/hr/performance");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await performanceTrackerApi.get(id);
      const t = res.data;
      setTracker(t);
      setSupervisorSummary(t.supervisor_summary ?? "");
      setHrSummary(t.hr_summary ?? "");
    } catch {
      setError("Failed to load performance profile.");
      setTracker(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveSummaries = async () => {
    if (!tracker || !Number.isFinite(tracker.id)) return;
    setSaving(true);
    setSaved(false);
    try {
      await performanceTrackerApi.update(tracker.id, {
        supervisor_summary: supervisorSummary || null,
        hr_summary: hrSummary || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError("Failed to save notes.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">Loading profile…</span>
        </div>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="space-y-6 max-w-5xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? "Not found"}
        </div>
        <Link href="/hr/performance" className="text-sm font-semibold text-primary hover:underline">
          Back to Performance Tracker
        </Link>
      </div>
    );
  }

  const employeeName = tracker.employee?.name ?? `Employee #${tracker.employee_id}`;

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <Link href="/hr" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
          HR
        </Link>
        <Link href="/hr/performance" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 block">
          Performance Tracker
        </Link>
        <h1 className="page-title">{employeeName}</h1>
        <p className="page-subtitle">
          Cycle: {formatDate(tracker.cycle_start)} – {formatDate(tracker.cycle_end)}
        </p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Status and trend */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-neutral-500">Status</span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_CLS[tracker.status] ?? ""}`}>
            {STATUS_LABELS[tracker.status] ?? tracker.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-neutral-500">Trend</span>
          <span className="text-sm font-medium text-neutral-700">
            {TREND_LABELS[tracker.trend] ?? tracker.trend}
          </span>
        </div>
        {(tracker.probation_flag || tracker.hr_attention_required || tracker.management_attention_required) && (
          <div className="flex flex-wrap gap-2">
            {tracker.probation_flag && <span className="badge badge-warning">Probation</span>}
            {tracker.hr_attention_required && <span className="badge badge-danger">HR attention</span>}
            {tracker.management_attention_required && <span className="badge badge-warning">Management attention</span>}
          </div>
        )}
      </div>

      {/* Dimension scores */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Performance dimensions</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DIMENSIONS.map(({ key, label }) => {
            const value = tracker[key as keyof PerformanceTracker];
            const num = typeof value === "number" ? value : null;
            return (
              <div key={key} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <span className="text-sm text-neutral-700">{label}</span>
                {num != null ? (
                  <span className="text-sm font-semibold text-neutral-900">{num}/10</span>
                ) : (
                  <span className="text-xs text-neutral-400">—</span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Counts */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">Activity summary</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Completed tasks</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.completed_task_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Overdue</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.overdue_task_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Commendations</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.commendation_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">Development actions</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.active_development_action_count}</p>
          </div>
        </div>
        {tracker.assignment_completion_rate != null && (
          <p className="mt-3 text-sm text-neutral-600">
            Assignment completion rate: <strong>{tracker.assignment_completion_rate}%</strong>
          </p>
        )}
      </div>

      {/* Summaries (editable by supervisor/HR) */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">Supervisor & HR notes</h2>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">Supervisor summary</label>
          <textarea
            className="form-input min-h-[100px] resize-y"
            value={supervisorSummary}
            onChange={(e) => setSupervisorSummary(e.target.value)}
            placeholder="Add supervisor notes…"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-neutral-700 mb-1">HR summary</label>
          <textarea
            className="form-input min-h-[100px] resize-y"
            value={hrSummary}
            onChange={(e) => setHrSummary(e.target.value)}
            placeholder="Add HR notes…"
          />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSaveSummaries}
            disabled={saving}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[18px]">{saving ? "progress_activity" : "save"}</span>
            {saving ? "Saving…" : "Save notes"}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Saved
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/hr/performance" className="text-sm font-semibold text-primary hover:underline">
          Back to Performance Tracker
        </Link>
      </div>
    </div>
  );
}
