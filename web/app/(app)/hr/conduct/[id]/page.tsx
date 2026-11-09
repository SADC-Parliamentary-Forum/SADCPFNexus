"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { conductApi, type ConductRecord } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Lookup Tables ─────────────────────────────────────────────────────────────

const RECORD_TYPE_LABELS: Record<string, string> = {
  commendation: "hr.conduct.type.commendation",
  verbal_counseling: "hr.conduct.type.verbalCounseling",
  written_warning: "hr.conduct.type.writtenWarning",
  final_warning: "hr.conduct.type.finalWarning",
  suspension: "hr.conduct.type.suspension",
  dismissal: "hr.conduct.type.dismissal",
  performance_improvement: "hr.conduct.type.performanceImprovement",
};

const RECORD_TYPE_CLS: Record<string, string> = {
  commendation: "bg-green-100 text-green-800 border-green-200",
  verbal_counseling: "bg-amber-100 text-amber-800 border-amber-200",
  written_warning: "bg-orange-100 text-orange-800 border-orange-200",
  final_warning: "bg-red-100 text-red-800 border-red-200",
  suspension: "bg-red-100 text-red-800 border-red-200",
  dismissal: "bg-red-100 text-red-800 border-red-200",
  performance_improvement: "bg-blue-100 text-blue-800 border-blue-200",
};

const RECORD_TYPE_ICON: Record<string, string> = {
  commendation: "stars",
  verbal_counseling: "record_voice_over",
  written_warning: "warning",
  final_warning: "report",
  suspension: "block",
  dismissal: "person_off",
  performance_improvement: "trending_up",
};

const RECORD_TYPE_SEVERITY: Record<string, "positive" | "low" | "medium" | "high"> = {
  commendation: "positive",
  performance_improvement: "low",
  verbal_counseling: "low",
  written_warning: "medium",
  final_warning: "high",
  suspension: "high",
  dismissal: "high",
};

const STATUS_LABELS: Record<string, string> = {
  open: "hr.conduct.status.open",
  acknowledged: "hr.conduct.status.acknowledged",
  under_appeal: "hr.conduct.detail.statusUnderAppeal",
  resolved: "hr.conduct.status.resolved",
  closed: "hr.conduct.status.closed",
};

const STATUS_ORDER: Record<string, number> = {
  open: 1,
  acknowledged: 2,
  under_appeal: 3,
  resolved: 4,
  closed: 5,
};

// ─── Workflow step definitions ─────────────────────────────────────────────────

interface WorkflowStep {
  key: string;
  label: string;
  icon: string;
  applicableWhen: (r: ConductRecord) => boolean;
  completedWhen: (r: ConductRecord) => boolean;
  activeWhen: (r: ConductRecord) => boolean;
  date: (r: ConductRecord) => string | null;
  content: (r: ConductRecord) => React.ReactNode;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: string | null | undefined) {
  if (!d) return "—";
  const dt = new Date(d);
  if (!Number.isFinite(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ name, size = "lg" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = {
    sm: "w-8 h-8 text-xs",
    md: "w-10 h-10 text-sm",
    lg: "w-14 h-14 text-base",
  };
  return (
    <div
      className={`rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0 ${sizeClasses[size]}`}
    >
      {initials(name)}
    </div>
  );
}

// ─── Section Icon ─────────────────────────────────────────────────────────────

function SectionIcon({
  icon,
  colorClass,
  bgClass,
}: {
  icon: string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div
      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bgClass}`}
    >
      <span className={`material-symbols-outlined text-[18px] ${colorClass}`}>{icon}</span>
    </div>
  );
}

// ─── Workflow Timeline Step ───────────────────────────────────────────────────

function TimelineStep({
  step,
  record,
  isLast,
}: {
  step: WorkflowStep;
  record: ConductRecord;
  isLast: boolean;
}) {
  const { t } = useI18n();
  const completed = step.completedWhen(record);
  const active = step.activeWhen(record);
  const applicable = step.applicableWhen(record);
  const date = step.date(record);

  if (!applicable) return null;

  return (
    <div className="flex gap-4">
      {/* Left: connector line + icon */}
      <div className="flex flex-col items-center">
        <div
          className={`w-9 h-9 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            completed
              ? "bg-emerald-500 border-emerald-500 text-white"
              : active
              ? "bg-primary border-primary text-white shadow-[0_0_0_4px_rgba(29,133,237,0.15)]"
              : "bg-white border-neutral-200 text-neutral-400"
          }`}
        >
          {completed ? (
            <span className="material-symbols-outlined text-[16px]">check</span>
          ) : (
            <span className="material-symbols-outlined text-[16px]">{step.icon}</span>
          )}
        </div>
        {!isLast && (
          <div
            className={`w-0.5 flex-1 mt-1 min-h-[24px] ${completed ? "bg-emerald-300" : "bg-neutral-200"}`}
          />
        )}
      </div>

      {/* Right: content */}
      <div className={`pb-6 flex-1 min-w-0 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-sm font-semibold ${
              active ? "text-primary" : completed ? "text-neutral-900" : "text-neutral-500"
            }`}
          >
            {step.label}
          </span>
          {active && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-wider">
              {t("hr.conduct.detail.current")}
            </span>
          )}
          {completed && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              {t("hr.conduct.detail.done")}
            </span>
          )}
        </div>
        {date && (
          <p className="text-xs text-neutral-400 mb-2 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">calendar_today</span>
            {formatDate(date)}
          </p>
        )}
        {(completed || active) && (
          <div className="text-sm text-neutral-600 leading-relaxed">
            {step.content(record)}
          </div>
        )}
        {!completed && !active && (
          <p className="text-xs text-neutral-400 italic">{t("hr.conduct.detail.notReached")}</p>
        )}
      </div>
    </div>
  );
}

// ─── Action Panel ─────────────────────────────────────────────────────────────

function ActionPanel({
  record,
  saving,
  onStatusChange,
}: {
  record: ConductRecord;
  saving: boolean;
  onStatusChange: (newStatus: string) => void;
}) {
  const { t } = useI18n();
  const statusRank = STATUS_ORDER[record.status] ?? 0;
  const isCommendation = record.record_type === "commendation";

  const actions: Array<{ label: string; icon: string; nextStatus: string; style: string; condition: boolean }> = [
    {
      label: t("hr.conduct.detail.markInvestigated"),
      icon: "manage_search",
      nextStatus: "acknowledged",
      style: "btn-secondary w-full justify-start",
      condition: record.status === "open" && !isCommendation,
    },
    {
      label: t("hr.conduct.detail.recordHearing"),
      icon: "record_voice_over",
      nextStatus: "resolved",
      style: "btn-primary w-full justify-start",
      condition: statusRank >= 2 && statusRank < 4 && !isCommendation,
    },
    {
      label: t("hr.conduct.detail.closeRecord"),
      icon: "lock",
      nextStatus: "closed",
      style: "btn-secondary w-full justify-start",
      condition: record.status === "resolved" || record.status === "acknowledged",
    },
    {
      label: t("hr.conduct.detail.acknowledgeCommendation"),
      icon: "thumb_up",
      nextStatus: "acknowledged",
      style: "btn-primary w-full justify-start",
      condition: isCommendation && record.status === "open",
    },
    {
      label: t("hr.conduct.detail.closeCommendation"),
      icon: "lock",
      nextStatus: "closed",
      style: "btn-secondary w-full justify-start",
      condition: isCommendation && record.status === "acknowledged",
    },
  ];

  const available = actions.filter((a) => a.condition);

  if (available.length === 0) {
    return (
      <div className="card p-4 text-center">
        <span className="material-symbols-outlined text-[28px] text-neutral-200 block mb-2">
          check_circle
        </span>
        <p className="text-xs text-neutral-500">
          {record.status === "closed"
            ? t("hr.conduct.detail.closedNoAction")
            : t("hr.conduct.detail.noActions")}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        {t("hr.conduct.detail.availableActions")}
      </h3>
      {available.map((action) => (
        <button
          key={action.nextStatus}
          type="button"
          disabled={saving}
          onClick={() => onStatusChange(action.nextStatus)}
          className={`${action.style} gap-2 py-2.5 px-3 text-sm disabled:opacity-50`}
        >
          <span className="material-symbols-outlined text-[16px]">{action.icon}</span>
          {saving ? t("hr.conduct.saving") : action.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConductDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const id = params?.id != null ? Number(params.id) : NaN;

  const [record, setRecord] = useState<ConductRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Notes / investigation textarea
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(id)) {
      router.replace("/hr/conduct");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await conductApi.get(id);
      const data = res.data as ConductRecord;
      setRecord(data);
      setNotes(data.appeal_notes ?? "");
    } catch {
      setError(t("hr.conduct.detail.loadFailed"));
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id, router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (newStatus: string) => {
    if (!record) return;
    setSaving(true);
    try {
      const res = await conductApi.update(id, { status: newStatus });
      setRecord(res.data as ConductRecord);
      toast("success", t("hr.conduct.detail.statusUpdated"), t("hr.conduct.detail.markedAs", { status: STATUS_LABELS[newStatus] ? t(STATUS_LABELS[newStatus]) : newStatus }));
    } catch {
      toast("error", t("hr.conduct.detail.updateFailed"), t("hr.conduct.detail.updateFailedHint"));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!record) return;
    setSavingNotes(true);
    try {
      const res = await conductApi.update(id, { appeal_notes: notes });
      setRecord(res.data as ConductRecord);
      toast("success", t("hr.conduct.detail.notesSaved"), t("hr.conduct.detail.notesSavedHint"));
    } catch {
      toast("error", t("hr.conduct.detail.saveFailed"), t("hr.conduct.detail.saveFailedHint"));
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        {/* Skeleton header */}
        <div className="space-y-2">
          <div className="h-3 w-40 bg-neutral-100 rounded animate-pulse" />
          <div className="h-7 w-72 bg-neutral-100 rounded animate-pulse" />
          <div className="h-4 w-52 bg-neutral-100 rounded animate-pulse" />
        </div>
        {/* Skeleton hero */}
        <div className="card p-6 animate-pulse">
          <div className="flex gap-4">
            <div className="w-14 h-14 rounded-full bg-neutral-100" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-48 bg-neutral-100 rounded" />
              <div className="h-4 w-32 bg-neutral-100 rounded" />
              <div className="flex gap-2 mt-1">
                <div className="h-6 w-24 bg-neutral-100 rounded-full" />
                <div className="h-6 w-20 bg-neutral-100 rounded-full" />
              </div>
            </div>
          </div>
        </div>
        {/* Skeleton body */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div className="card p-5 h-48 animate-pulse" />
            <div className="card p-5 h-64 animate-pulse" />
          </div>
          <div className="space-y-4">
            <div className="card p-4 h-36 animate-pulse" />
            <div className="card p-4 h-28 animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error ?? t("hr.conduct.detail.notFound")}
        </div>
        <Link
          href="/hr/conduct"
          className="btn-secondary text-sm inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          {t("hr.conduct.detail.backToList")}
        </Link>
      </div>
    );
  }

  const employeeName = record.employee?.name ?? t("hr.conduct.detail.employeeFallback", { id: record.employee_id });
  const recordedByName = record.recorded_by?.name ?? (record.recorded_by_id ? `#${record.recorded_by_id}` : "—");
  const severity = RECORD_TYPE_SEVERITY[record.record_type] ?? "medium";

  // Workflow steps definition
  const WORKFLOW_STEPS: WorkflowStep[] = [
    {
      key: "opened",
      label: t("hr.conduct.detail.stepOpened"),
      icon: "folder_open",
      applicableWhen: () => true,
      completedWhen: () => true,
      activeWhen: (r) => r.status === "open" || r.status === "acknowledged",
      date: (r) => r.created_at,
      content: (r) => (
        <div className="space-y-1">
          <p>
            {t("hr.conduct.detail.createdBy")}{" "}
            <span className="font-semibold text-neutral-800">{recordedByName}</span>.
          </p>
          {r.incident_date && (
            <p>
              {t("hr.conduct.detail.incidentDateLabel")}{" "}
              <span className="font-semibold text-neutral-800">{formatDate(r.incident_date)}</span>
            </p>
          )}
          <p className="text-neutral-500 text-xs">
            {t("hr.conduct.detail.issueDateValue", { date: formatDate(r.issue_date) })}
          </p>
        </div>
      ),
    },
    {
      key: "investigation",
      label: t("hr.conduct.detail.stepInvestigation"),
      icon: "manage_search",
      applicableWhen: (r) =>
        r.record_type !== "commendation",
      completedWhen: (r) =>
        ["acknowledged", "resolved", "closed"].includes(r.status),
      activeWhen: (r) => r.status === "open",
      date: (r) =>
        ["acknowledged", "resolved", "closed"].includes(r.status) ? r.updated_at : null,
      content: (r) => (
        <div>
          {r.appeal_notes ? (
            <p className="whitespace-pre-wrap">{r.appeal_notes}</p>
          ) : (
            <p className="text-neutral-400 italic text-xs">{t("hr.conduct.detail.noNotes")}</p>
          )}
        </div>
      ),
    },
    {
      key: "hearing",
      label: t("hr.conduct.detail.stepHearing"),
      icon: "groups",
      applicableWhen: (r) =>
        !["commendation", "performance_improvement"].includes(r.record_type),
      completedWhen: (r) => ["resolved", "closed"].includes(r.status),
      activeWhen: (r) => r.status === "acknowledged",
      date: (r) => (["resolved", "closed"].includes(r.status) ? r.updated_at : null),
      content: (r) => (
        <div className="space-y-1">
          {r.reviewed_by ? (
            <p>
              {t("hr.conduct.detail.chairedBy")}{" "}
              <span className="font-semibold text-neutral-800">{r.reviewed_by.name}</span>
            </p>
          ) : null}
          <p className="text-neutral-500 text-xs">
            {t("hr.conduct.detail.hearingCompleted")}
          </p>
        </div>
      ),
    },
    {
      key: "outcome",
      label: t("hr.conduct.detail.outcome"),
      icon: "gavel",
      applicableWhen: () => true,
      completedWhen: (r) => Boolean(r.outcome) || ["resolved", "closed"].includes(r.status),
      activeWhen: (r) => r.status === "resolved",
      date: (r) => (["resolved", "closed"].includes(r.status) ? r.updated_at : null),
      content: (r) => (
        <div>
          {r.outcome ? (
            <p className="whitespace-pre-wrap">{r.outcome}</p>
          ) : (
            <p className="text-neutral-400 italic text-xs">
              {r.record_type === "commendation"
                ? t("hr.conduct.detail.commendationIssued")
                : t("hr.conduct.detail.noOutcome")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "closed",
      label: t("hr.conduct.detail.stepClosed"),
      icon: "lock",
      applicableWhen: () => true,
      completedWhen: (r) => r.status === "closed",
      activeWhen: (r) => r.status === "resolved",
      date: (r) => (r.status === "closed" ? r.resolution_date ?? r.updated_at : r.resolution_date),
      content: (r) => (
        <div className="space-y-1">
          {r.resolution_date && (
            <p>
              {t("hr.conduct.detail.closedOn")}{" "}
              <span className="font-semibold text-neutral-800">{formatDate(r.resolution_date)}</span>
            </p>
          )}
          {r.reviewed_by && (
            <p className="text-xs text-neutral-500">
              {t("hr.conduct.detail.reviewedByName", { name: r.reviewed_by.name })}
            </p>
          )}
        </div>
      ),
    },
  ];

  const applicableSteps = WORKFLOW_STEPS.filter((s) => s.applicableWhen(record));

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={record.title}
        subtitle={t("hr.conduct.detail.subtitle", { name: employeeName })}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: t("hr.conduct.detail.crumb"), href: "/hr/conduct" },
              { label: record.title },
            ]}
          />
        }
      />

      {/* ── Hero Header Card ── */}
      <div className="card p-5">
        <div className="flex flex-wrap items-start gap-4">
          {/* Employee avatar */}
          <Avatar name={employeeName} size="lg" />

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <h2 className="text-lg font-bold text-neutral-900">{employeeName}</h2>
              {record.is_confidential && (
                <span className="badge-warning flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">lock</span>
                  {t("hr.conduct.detail.confidential")}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Record type badge */}
              <span
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                  RECORD_TYPE_CLS[record.record_type] ?? "bg-neutral-100 text-neutral-700"
                }`}
              >
                <span className="material-symbols-outlined text-[13px]">
                  {RECORD_TYPE_ICON[record.record_type] ?? "info"}
                </span>
                {RECORD_TYPE_LABELS[record.record_type] ? t(RECORD_TYPE_LABELS[record.record_type]) : record.record_type}
              </span>

              {/* Status badge */}
              <span className="badge-muted flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">flag</span>
                {STATUS_LABELS[record.status] ? t(STATUS_LABELS[record.status]) : record.status}
              </span>

              {/* Severity indicator */}
              {severity === "positive" && (
                <span className="badge-success flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">sentiment_satisfied</span>
                  {t("hr.conduct.detail.positive")}
                </span>
              )}
              {severity === "high" && (
                <span className="badge-danger flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">priority_high</span>
                  {t("hr.conduct.detail.highSeverity")}
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                {t("hr.conduct.detail.issueDateLabel")} <span className="text-neutral-700 font-medium ml-1">{formatDate(record.issue_date)}</span>
              </span>
              {record.incident_date && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">event_available</span>
                  {t("hr.conduct.detail.incidentLabel")} <span className="text-neutral-700 font-medium ml-1">{formatDate(record.incident_date)}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">person</span>
                {t("hr.conduct.detail.recordedByLabel")} <span className="text-neutral-700 font-medium ml-1">{recordedByName}</span>
              </span>
              {record.reviewed_by && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">supervisor_account</span>
                  {t("hr.conduct.detail.reviewedByLabel")} <span className="text-neutral-700 font-medium ml-1">{record.reviewed_by.name}</span>
                </span>
              )}
              {record.resolution_date && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  {t("hr.conduct.detail.resolvedLabel")} <span className="text-neutral-700 font-medium ml-1">{formatDate(record.resolution_date)}</span>
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Main grid: timeline + sidebar ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── LEFT: workflow + description + notes ── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Workflow Timeline */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <SectionIcon icon="account_tree" colorClass="text-primary" bgClass="bg-primary/10" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">{t("hr.conduct.detail.workflow")}</h3>
                  <p className="text-xs text-neutral-400">{t("hr.conduct.detail.workflowHint")}</p>
                </div>
              </div>
            </div>
            <div className="p-5">
              {applicableSteps.map((step, idx) => (
                <TimelineStep
                  key={step.key}
                  step={step}
                  record={record}
                  isLast={idx === applicableSteps.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Description card */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <SectionIcon icon="description" colorClass="text-neutral-600" bgClass="bg-neutral-100" />
                <h3 className="text-sm font-semibold text-neutral-900">{t("hr.conduct.detail.fullDescription")}</h3>
              </div>
            </div>
            <div className="p-5">
              <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                {record.description}
              </p>
            </div>
          </div>

          {/* Outcome card (if present) */}
          {record.outcome && (
            <div className="card overflow-hidden">
              <div className="card-header">
                <div className="flex items-center gap-2">
                  <SectionIcon icon="gavel" colorClass="text-primary" bgClass="bg-primary/10" />
                  <h3 className="text-sm font-semibold text-neutral-900">{t("hr.conduct.detail.outcome")}</h3>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">
                  {record.outcome}
                </p>
              </div>
            </div>
          )}

          {/* Investigation Notes */}
          <div className="card overflow-hidden">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <SectionIcon icon="edit_note" colorClass="text-amber-700" bgClass="bg-amber-50" />
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">{t("hr.conduct.detail.investigationNotes")}</h3>
                  <p className="text-xs text-neutral-400">
                    {t("hr.conduct.detail.notesHint")}
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                rows={5}
                className="form-input resize-none text-sm"
                placeholder={t("hr.conduct.detail.notesPlaceholder")}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  {t("hr.conduct.detail.hrOnly")}
                </p>
                <button
                  type="button"
                  disabled={savingNotes || notes === (record.appeal_notes ?? "")}
                  onClick={handleSaveNotes}
                  className="btn-secondary py-2 px-4 text-xs gap-1.5 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  {savingNotes ? t("hr.conduct.saving") : t("hr.conduct.detail.saveNotes")}
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* ── RIGHT: sidebar ── */}
        <div className="space-y-4">

          {/* Actions panel */}
          <ActionPanel record={record} saving={saving} onStatusChange={handleStatusChange} />

          {/* Record details card */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t("hr.conduct.new.recordDetails")}
            </h3>
            <dl className="space-y-2.5">
              {[
                { label: t("hr.conduct.detail.recordId"), value: `#${record.id}` },
                { label: t("hr.conduct.type"), value: RECORD_TYPE_LABELS[record.record_type] ? t(RECORD_TYPE_LABELS[record.record_type]) : record.record_type },
                { label: t("hr.conduct.statusLabel"), value: STATUS_LABELS[record.status] ? t(STATUS_LABELS[record.status]) : record.status },
                { label: t("hr.conduct.issueDate"), value: formatDate(record.issue_date) },
                { label: t("hr.conduct.detail.incidentDate"), value: formatDate(record.incident_date) },
                { label: t("hr.conduct.detail.resolutionDate"), value: formatDate(record.resolution_date) },
                { label: t("hr.conduct.detail.confidential"), value: record.is_confidential ? t("hr.conduct.detail.yes") : t("hr.conduct.detail.no") },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2 text-xs">
                  <dt className="text-neutral-500 flex-shrink-0">{label}</dt>
                  <dd className="text-neutral-800 font-medium text-right truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Related parties card */}
          <div className="card p-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              {t("hr.conduct.detail.parties")}
            </h3>
            {/* Employee */}
            <div className="flex items-center gap-2">
              <Avatar name={employeeName} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-800 truncate">{employeeName}</p>
                <p className="text-[10px] text-neutral-400">{record.employee?.email ?? t("hr.conduct.employee")}</p>
              </div>
            </div>
            {/* Recorded by */}
            {record.recorded_by && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[14px] text-neutral-500">edit</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-800 truncate">{record.recorded_by.name}</p>
                  <p className="text-[10px] text-neutral-400">{t("hr.conduct.detail.recordedBy")}</p>
                </div>
              </div>
            )}
            {/* Reviewed by */}
            {record.reviewed_by && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
                  <span className="material-symbols-outlined text-[14px] text-neutral-500">supervisor_account</span>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-neutral-800 truncate">{record.reviewed_by.name}</p>
                  <p className="text-[10px] text-neutral-400">{t("hr.conduct.detail.reviewedBy")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Appeal notes if present and different from investigation notes */}
          {record.appeal_notes && record.appeal_notes !== notes && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                {t("hr.conduct.detail.appealNotes")}
              </h3>
              <p className="text-xs text-neutral-600 whitespace-pre-wrap">{record.appeal_notes}</p>
            </div>
          )}

          {/* Back link */}
          <Link
            href="/hr/conduct"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 hover:text-primary transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">arrow_back</span>
            {t("hr.conduct.detail.allRecords")}
          </Link>
        </div>
      </div>
    </div>
  );
}
