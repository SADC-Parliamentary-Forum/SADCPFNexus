"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { conductApi, type ConductRecord } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

// ─── Lookup Tables ─────────────────────────────────────────────────────────────

const RECORD_TYPE_LABELS: Record<string, string> = {
  commendation: "Commendation",
  verbal_counseling: "Verbal Counseling",
  written_warning: "Written Warning",
  final_warning: "Final Warning",
  suspension: "Suspension",
  dismissal: "Dismissal",
  performance_improvement: "Performance Improvement",
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
  open: "Open",
  acknowledged: "Acknowledged",
  under_appeal: "Under Appeal",
  resolved: "Resolved",
  closed: "Closed",
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
              Current
            </span>
          )}
          {completed && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
              Done
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
          <p className="text-xs text-neutral-400 italic">Not yet reached</p>
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
  const statusRank = STATUS_ORDER[record.status] ?? 0;
  const isCommendation = record.record_type === "commendation";

  const actions: Array<{ label: string; icon: string; nextStatus: string; style: string; condition: boolean }> = [
    {
      label: "Mark as Investigated",
      icon: "manage_search",
      nextStatus: "acknowledged",
      style: "btn-secondary w-full justify-start",
      condition: record.status === "open" && !isCommendation,
    },
    {
      label: "Record Hearing Outcome",
      icon: "record_voice_over",
      nextStatus: "resolved",
      style: "btn-primary w-full justify-start",
      condition: statusRank >= 2 && statusRank < 4 && !isCommendation,
    },
    {
      label: "Close Record",
      icon: "lock",
      nextStatus: "closed",
      style: "btn-secondary w-full justify-start",
      condition: record.status === "resolved" || record.status === "acknowledged",
    },
    {
      label: "Acknowledge Commendation",
      icon: "thumb_up",
      nextStatus: "acknowledged",
      style: "btn-primary w-full justify-start",
      condition: isCommendation && record.status === "open",
    },
    {
      label: "Close Commendation",
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
            ? "This record has been closed and requires no further action."
            : "No available actions for the current status."}
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-3">
        Available Actions
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
          {saving ? "Saving…" : action.label}
        </button>
      ))}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ConductDetailPage() {
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
      setError("Failed to load conduct record.");
      setRecord(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (newStatus: string) => {
    if (!record) return;
    setSaving(true);
    try {
      const res = await conductApi.update(id, { status: newStatus });
      setRecord(res.data as ConductRecord);
      toast("success", "Status updated", `Record marked as ${STATUS_LABELS[newStatus] ?? newStatus}.`);
    } catch {
      toast("error", "Update failed", "Could not update record status.");
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
      toast("success", "Notes saved", "Investigation notes have been saved.");
    } catch {
      toast("error", "Save failed", "Could not save investigation notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6 max-w-5xl">
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
      <div className="space-y-4 max-w-3xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error ?? "Conduct record not found."}
        </div>
        <Link
          href="/hr/conduct"
          className="text-sm font-semibold text-primary hover:underline inline-flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[15px]">arrow_back</span>
          Back to Conduct & Recognition
        </Link>
      </div>
    );
  }

  const employeeName = record.employee?.name ?? `Employee #${record.employee_id}`;
  const recordedByName = record.recorded_by?.name ?? (record.recorded_by_id ? `#${record.recorded_by_id}` : "—");
  const severity = RECORD_TYPE_SEVERITY[record.record_type] ?? "medium";

  // Workflow steps definition
  const WORKFLOW_STEPS: WorkflowStep[] = [
    {
      key: "opened",
      label: "Record Opened",
      icon: "folder_open",
      applicableWhen: () => true,
      completedWhen: () => true,
      activeWhen: (r) => r.status === "open" || r.status === "acknowledged",
      date: (r) => r.created_at,
      content: (r) => (
        <div className="space-y-1">
          <p>
            Record created by{" "}
            <span className="font-semibold text-neutral-800">{recordedByName}</span>.
          </p>
          {r.incident_date && (
            <p>
              Incident date:{" "}
              <span className="font-semibold text-neutral-800">{formatDate(r.incident_date)}</span>
            </p>
          )}
          <p className="text-neutral-500 text-xs">
            Issue date: {formatDate(r.issue_date)}
          </p>
        </div>
      ),
    },
    {
      key: "investigation",
      label: "Investigation",
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
            <p className="text-neutral-400 italic text-xs">No investigation notes recorded yet.</p>
          )}
        </div>
      ),
    },
    {
      key: "hearing",
      label: "Hearing / Meeting",
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
              Chaired by{" "}
              <span className="font-semibold text-neutral-800">{r.reviewed_by.name}</span>
            </p>
          ) : null}
          <p className="text-neutral-500 text-xs">
            Hearing completed — outcome recorded below.
          </p>
        </div>
      ),
    },
    {
      key: "outcome",
      label: "Outcome / Decision",
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
                ? "Commendation issued."
                : "No formal outcome text recorded."}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "closed",
      label: "Closed / Resolved",
      icon: "lock",
      applicableWhen: () => true,
      completedWhen: (r) => r.status === "closed",
      activeWhen: (r) => r.status === "resolved",
      date: (r) => (r.status === "closed" ? r.resolution_date ?? r.updated_at : r.resolution_date),
      content: (r) => (
        <div className="space-y-1">
          {r.resolution_date && (
            <p>
              Closed on{" "}
              <span className="font-semibold text-neutral-800">{formatDate(r.resolution_date)}</span>
            </p>
          )}
          {r.reviewed_by && (
            <p className="text-xs text-neutral-500">
              Reviewed by {r.reviewed_by.name}
            </p>
          )}
        </div>
      ),
    },
  ];

  const applicableSteps = WORKFLOW_STEPS.filter((s) => s.applicableWhen(record));

  return (
    <div className="space-y-6 max-w-5xl">
      {/* ── Breadcrumb ── */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-neutral-500 mb-3">
          <Link href="/hr" className="hover:text-neutral-700 transition-colors">
            HR
          </Link>
          <span className="material-symbols-outlined text-[13px]">chevron_right</span>
          <Link href="/hr/conduct" className="hover:text-neutral-700 transition-colors">
            Conduct & Recognition
          </Link>
          <span className="material-symbols-outlined text-[13px]">chevron_right</span>
          <span className="text-neutral-700 font-medium truncate max-w-[200px]">{record.title}</span>
        </div>

        <h1 className="page-title">{record.title}</h1>
        <p className="page-subtitle">Progressive discipline record for {employeeName}</p>
      </div>

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
                  Confidential
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
                {RECORD_TYPE_LABELS[record.record_type] ?? record.record_type}
              </span>

              {/* Status badge */}
              <span className="badge-muted flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">flag</span>
                {STATUS_LABELS[record.status] ?? record.status}
              </span>

              {/* Severity indicator */}
              {severity === "positive" && (
                <span className="badge-success flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">sentiment_satisfied</span>
                  Positive Record
                </span>
              )}
              {severity === "high" && (
                <span className="badge-danger flex items-center gap-1">
                  <span className="material-symbols-outlined text-[11px]">priority_high</span>
                  High Severity
                </span>
              )}
            </div>

            {/* Meta row */}
            <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">calendar_today</span>
                Issue date: <span className="text-neutral-700 font-medium ml-1">{formatDate(record.issue_date)}</span>
              </span>
              {record.incident_date && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">event_available</span>
                  Incident: <span className="text-neutral-700 font-medium ml-1">{formatDate(record.incident_date)}</span>
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">person</span>
                Recorded by: <span className="text-neutral-700 font-medium ml-1">{recordedByName}</span>
              </span>
              {record.reviewed_by && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">supervisor_account</span>
                  Reviewed by: <span className="text-neutral-700 font-medium ml-1">{record.reviewed_by.name}</span>
                </span>
              )}
              {record.resolution_date && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">check_circle</span>
                  Resolved: <span className="text-neutral-700 font-medium ml-1">{formatDate(record.resolution_date)}</span>
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
                  <h3 className="text-sm font-semibold text-neutral-900">Discipline Workflow</h3>
                  <p className="text-xs text-neutral-400">Progressive discipline timeline</p>
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
                <h3 className="text-sm font-semibold text-neutral-900">Full Description</h3>
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
                  <SectionIcon icon="gavel" colorClass="text-purple-600" bgClass="bg-purple-50" />
                  <h3 className="text-sm font-semibold text-neutral-900">Outcome / Decision</h3>
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
                  <h3 className="text-sm font-semibold text-neutral-900">Investigation Notes</h3>
                  <p className="text-xs text-neutral-400">
                    HR-only notes and evidence. Not visible to the employee.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <textarea
                rows={5}
                className="form-input resize-none text-sm"
                placeholder="Record investigation findings, evidence, meeting summaries, witness statements…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">lock</span>
                  Confidential — HR use only
                </p>
                <button
                  type="button"
                  disabled={savingNotes || notes === (record.appeal_notes ?? "")}
                  onClick={handleSaveNotes}
                  className="btn-secondary py-2 px-4 text-xs gap-1.5 disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[14px]">save</span>
                  {savingNotes ? "Saving…" : "Save notes"}
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
              Record Details
            </h3>
            <dl className="space-y-2.5">
              {[
                { label: "Record ID", value: `#${record.id}` },
                { label: "Type", value: RECORD_TYPE_LABELS[record.record_type] ?? record.record_type },
                { label: "Status", value: STATUS_LABELS[record.status] ?? record.status },
                { label: "Issue Date", value: formatDate(record.issue_date) },
                { label: "Incident Date", value: formatDate(record.incident_date) },
                { label: "Resolution Date", value: formatDate(record.resolution_date) },
                { label: "Confidential", value: record.is_confidential ? "Yes" : "No" },
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
              Parties Involved
            </h3>
            {/* Employee */}
            <div className="flex items-center gap-2">
              <Avatar name={employeeName} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-neutral-800 truncate">{employeeName}</p>
                <p className="text-[10px] text-neutral-400">{record.employee?.email ?? "Employee"}</p>
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
                  <p className="text-[10px] text-neutral-400">Recorded by</p>
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
                  <p className="text-[10px] text-neutral-400">Reviewed by</p>
                </div>
              </div>
            )}
          </div>

          {/* Appeal notes if present and different from investigation notes */}
          {record.appeal_notes && record.appeal_notes !== notes && (
            <div className="card p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                Appeal Notes
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
            All Conduct Records
          </Link>
        </div>
      </div>
    </div>
  );
}
