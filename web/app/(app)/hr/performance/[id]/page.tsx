"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { performanceTrackerApi, type PerformanceTracker } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_LABELS: Record<string, string> = {
  excellent: "hr.performance.status.excellent",
  strong: "hr.performance.status.strong",
  satisfactory: "hr.performance.status.satisfactory",
  watchlist: "hr.performance.status.watchlist",
  at_risk: "hr.performance.status.at_risk",
  critical_review_required: "hr.performance.status.critical_review_required",
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
  improving: "hr.performance.trend.improving",
  stable: "hr.performance.trend.stable",
  declining: "hr.performance.trend.declining",
  inconsistent: "hr.performance.trend.inconsistent",
  insufficient_data: "hr.performance.trend.insufficient_data",
};

const DIMENSIONS = [
  { key: "output_score", label: "hr.performance.dim.output" },
  { key: "timeliness_score", label: "hr.performance.dim.timeliness" },
  { key: "quality_score", label: "hr.performance.dim.quality" },
  { key: "workload_score", label: "hr.performance.dim.workload" },
  { key: "update_compliance_score", label: "hr.performance.dim.updateCompliance" },
  { key: "development_progress_score", label: "hr.performance.dim.development" },
] as const;

function formatDate(d: string, localeTag: string) {
  return new Date(d).toLocaleDateString(localeTag, { day: "numeric", month: "short", year: "numeric" });
}

export default function PerformanceProfilePage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { t, localeTag } = useI18n();
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
      const data = res.data;
      setTracker(data);
      setSupervisorSummary(data.supervisor_summary ?? "");
      setHrSummary(data.hr_summary ?? "");
    } catch {
      setError(t("hr.performance.detail.loadFailed"));
      setTracker(null);
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

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
      toast.success(t("hr.performance.detail.notesSaved"));
    } catch (err) {
      setError(t("hr.performance.detail.notesSaveFailed"));
      toast.error(t("hr.performance.detail.notesNotSaved"), apiErrorMessage(err, t("hr.performance.detail.notesSaveFailed")));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="flex items-center justify-center py-20 text-neutral-500">
          <span className="material-symbols-outlined animate-spin text-[28px]">progress_activity</span>
          <span className="ml-2">{t("hr.performance.detail.loading")}</span>
        </div>
      </div>
    );
  }

  if (error || !tracker) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error ?? t("hr.performance.detail.notFound")}
        </div>
        <Link href="/hr/performance" className="btn-secondary text-sm">
          {t("hr.performance.detail.back")}
        </Link>
      </div>
    );
  }

  const employeeName = tracker.employee?.name ?? t("hr.performance.detail.employeeNumber", { id: tracker.employee_id });

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={employeeName}
        subtitle={t("hr.performance.detail.cycle", { start: formatDate(tracker.cycle_start, localeTag), end: formatDate(tracker.cycle_end, localeTag) })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "hr.performance.crumb", href: "/hr/performance" },
              { label: employeeName },
            ]}
          />
        }
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Status and trend */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-neutral-500">{t("hr.performance.detail.status")}</span>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium ${STATUS_CLS[tracker.status] ?? ""}`}>
            {STATUS_LABELS[tracker.status] ? t(STATUS_LABELS[tracker.status]) : tracker.status}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase text-neutral-500">{t("hr.performance.detail.trend")}</span>
          <span className="text-sm font-medium text-neutral-700">
            {TREND_LABELS[tracker.trend] ? t(TREND_LABELS[tracker.trend]) : tracker.trend}
          </span>
        </div>
        {(tracker.probation_flag || tracker.hr_attention_required || tracker.management_attention_required) && (
          <div className="flex flex-wrap gap-2">
            {tracker.probation_flag && <span className="badge badge-warning">{t("hr.performance.detail.probation")}</span>}
            {tracker.hr_attention_required && <span className="badge badge-danger">{t("hr.performance.detail.hrAttention")}</span>}
            {tracker.management_attention_required && <span className="badge badge-warning">{t("hr.performance.detail.mgmtAttention")}</span>}
          </div>
        )}
      </div>

      {/* Dimension scores */}
      <div className="card p-4">
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">{t("hr.performance.detail.dimensions")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {DIMENSIONS.map(({ key, label }) => {
            const value = tracker[key as keyof PerformanceTracker];
            const num = typeof value === "number" ? value : null;
            return (
              <div key={key} className="flex items-center justify-between rounded-lg bg-neutral-50 px-3 py-2">
                <span className="text-sm text-neutral-700">{t(label)}</span>
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
        <h2 className="text-sm font-semibold text-neutral-900 mb-3">{t("hr.performance.detail.activity")}</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">{t("hr.performance.detail.completedTasks")}</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.completed_task_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">{t("hr.performance.detail.overdue")}</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.overdue_task_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">{t("hr.performance.detail.commendations")}</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.commendation_count}</p>
          </div>
          <div className="rounded-lg bg-neutral-50 px-3 py-2">
            <p className="text-xs text-neutral-500">{t("hr.performance.detail.devActions")}</p>
            <p className="text-lg font-bold text-neutral-900">{tracker.active_development_action_count}</p>
          </div>
        </div>
        {tracker.assignment_completion_rate != null && (
          <p className="mt-3 text-sm text-neutral-600">
            {t("hr.performance.detail.completionRate")} <strong>{tracker.assignment_completion_rate}%</strong>
          </p>
        )}
      </div>

      {/* Summaries (editable by supervisor/HR) */}
      <div className="card p-4 space-y-4">
        <h2 className="text-sm font-semibold text-neutral-900">{t("hr.performance.detail.notes")}</h2>
        <div>
          <label htmlFor="hr-performance-detail-supervisor-summary" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.performance.detail.supervisorSummary")}</label>
          <textarea id="hr-performance-detail-supervisor-summary"
            className="form-input min-h-[100px] resize-y"
            value={supervisorSummary}
            onChange={(e) => setSupervisorSummary(e.target.value)}
            placeholder={t("hr.performance.detail.supervisorPlaceholder")}
          />
        </div>
        <div>
          <label htmlFor="hr-performance-detail-hr-summary" className="block text-xs font-semibold text-neutral-700 mb-1">{t("hr.performance.detail.hrSummary")}</label>
          <textarea id="hr-performance-detail-hr-summary"
            className="form-input min-h-[100px] resize-y"
            value={hrSummary}
            onChange={(e) => setHrSummary(e.target.value)}
            placeholder={t("hr.performance.detail.hrPlaceholder")}
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
            {saving ? t("hr.performance.detail.saving") : t("hr.performance.detail.saveNotes")}
          </button>
          {saved && (
            <span className="text-sm text-green-600 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              {t("hr.performance.detail.saved")}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Link href="/hr/performance" className="btn-secondary text-sm">
          {t("hr.performance.detail.back")}
        </Link>
      </div>
    </div>
  );
}
