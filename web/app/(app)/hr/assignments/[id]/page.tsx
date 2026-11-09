"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { workAssignmentsApi, WorkAssignment, WorkAssignmentUpdate } from "@/lib/api";
import { formatDate, formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const UPDATE_TYPE_ICONS: Record<string, string> = {
  progress: "radio_button_unchecked",
  blocker: "block",
  completion: "check_circle",
  comment: "chat",
  review: "rate_review",
};

const UPDATE_TYPE_COLORS: Record<string, string> = {
  progress: "text-blue-500",
  blocker: "text-red-500",
  completion: "text-green-500",
  comment: "text-neutral-500",
  review: "text-amber-500",
};

function priorityBadge(priority: WorkAssignment["priority"]) {
  const map: Record<string, string> = {
    critical: "badge-danger",
    high: "badge-warning",
    medium: "badge-primary",
    low: "badge-muted",
  };
  return map[priority] ?? "badge-muted";
}

function statusBadge(status: WorkAssignment["status"]) {
  const map: Record<string, string> = {
    draft: "badge-muted",
    assigned: "badge-primary",
    in_progress: "badge-primary",
    pending_review: "badge-warning",
    completed: "badge-success",
    overdue: "badge-danger",
    cancelled: "badge-muted",
  };
  return map[status] ?? "badge-muted";
}

const STATUS_LABEL_KEYS: Record<string, string> = {
  draft: "hr.assignments.status.draft",
  assigned: "hr.assignments.status.assigned",
  in_progress: "hr.assignments.status.inProgress",
  pending_review: "hr.assignments.status.pendingReview",
  completed: "hr.assignments.status.completed",
  overdue: "hr.assignments.status.overdue",
  cancelled: "hr.assignments.status.cancelled",
};

const PRIORITY_KEYS: Record<string, string> = {
  critical: "hr.assignments.priority.critical",
  high: "hr.assignments.priority.high",
  medium: "hr.assignments.priority.medium",
  low: "hr.assignments.priority.low",
};

function statusLabel(status: WorkAssignment["status"], t: (key: string) => string) {
  const key = STATUS_LABEL_KEYS[status];
  if (key) return t(key);
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignmentDetailPage() {
  const { t } = useI18n();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [assignment, setAssignment] = useState<WorkAssignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Add update form
  const [updateType, setUpdateType] = useState("comment");
  const [updateContent, setUpdateContent] = useState("");
  const [hoursLogged, setHoursLogged] = useState("");
  const [updateSubmitting, setUpdateSubmitting] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  // Complete modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completionNotes, setCompletionNotes] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workAssignmentsApi.get(Number(id));
      setAssignment(res.data);
    } catch {
      setError(t("hr.assignments.detail.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const handleStart = async () => {
    if (!assignment) return;
    setActionLoading(true);
    try {
      const res = await workAssignmentsApi.start(assignment.id);
      setAssignment(res.data);
      toast.success(t("hr.assignments.detail.started"));
    } catch (err) {
      toast.error(t("hr.assignments.detail.startFailedTitle"), apiErrorMessage(err, t("hr.assignments.detail.startFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!assignment) return;
    setActionLoading(true);
    try {
      const res = await workAssignmentsApi.complete(assignment.id, completionNotes || undefined);
      setAssignment(res.data);
      setShowCompleteModal(false);
      toast.success(t("hr.assignments.detail.completed"));
    } catch (err) {
      toast.error(t("hr.assignments.detail.completeFailedTitle"), apiErrorMessage(err, t("hr.assignments.detail.completeFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!assignment) return;
    if (!(await confirm({ title: t("hr.assignments.detail.cancelTitle"), message: t("hr.assignments.detail.cancelMessage"), variant: "danger" }))) return;
    setActionLoading(true);
    try {
      const res = await workAssignmentsApi.update(assignment.id, { status: "cancelled" });
      setAssignment(res.data);
      toast.success(t("hr.assignments.detail.cancelled"));
    } catch (err) {
      toast.error(t("hr.assignments.detail.cancelFailedTitle"), apiErrorMessage(err, t("hr.assignments.detail.cancelFailed")));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateContent.trim()) {
      setUpdateError(t("hr.assignments.detail.contentRequired"));
      return;
    }
    setUpdateSubmitting(true);
    setUpdateError(null);
    try {
      await workAssignmentsApi.addUpdate(Number(id), {
        update_type: updateType,
        content: updateContent,
        hours_logged: hoursLogged ? Number(hoursLogged) : undefined,
      });
      setUpdateContent("");
      setHoursLogged("");
      setUpdateType("comment");
      toast.success(t("hr.assignments.detail.updateSubmitted"));
      await load();
    } catch (err) {
      setUpdateError(t("hr.assignments.detail.updateFailed"));
      toast.error(t("hr.assignments.detail.updateNotSubmitted"), apiErrorMessage(err, t("hr.assignments.detail.updateFailed")));
    } finally {
      setUpdateSubmitting(false);
    }
  };

  if (loading) {
    return (
    <div className="space-y-4">
        <div className="h-8 w-64 bg-neutral-100 animate-pulse rounded" />
        <div className="card p-5 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-neutral-100 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !assignment) {
    return (
      <div className="p-6 text-center py-20 text-red-500">
        <span className="material-symbols-outlined text-[48px] block mb-2">error_outline</span>
        {error ?? t("hr.assignments.detail.notFound")}
        <div className="mt-4">
          <button className="btn-secondary" onClick={() => router.push("/hr/assignments")}>
            {t("hr.assignments.detail.back")}
          </button>
        </div>
      </div>
    );
  }

  const canStart = assignment.status === "assigned" || assignment.status === "draft";
  const canComplete = assignment.status === "in_progress" || assignment.status === "pending_review";
  const canCancel = !["completed", "cancelled"].includes(assignment.status);

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={assignment.title}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: t("hr.assignments.detail.crumb"), href: "/hr/assignments" },
              { label: assignment.title },
            ]}
          />
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${priorityBadge(assignment.priority)}`}>
              {t("hr.assignments.detail.priorityBadge", { priority: PRIORITY_KEYS[assignment.priority] ? t(PRIORITY_KEYS[assignment.priority]) : assignment.priority })}
            </span>
            <span className={`badge ${statusBadge(assignment.status)}`}>
              {statusLabel(assignment.status, t)}
            </span>
            {assignment.is_overdue && (
              <span className="badge badge-danger flex items-center gap-1">
                <span className="material-symbols-outlined text-[13px]">schedule</span>
                {t("hr.assignments.status.overdue")}
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {canStart && (
              <button className="btn-primary flex items-center gap-1" onClick={handleStart} disabled={actionLoading}>
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                {t("hr.assignments.detail.start")}
              </button>
            )}
            {canComplete && (
              <button
                className="btn-primary flex items-center gap-1"
                onClick={() => setShowCompleteModal(true)}
                disabled={actionLoading}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                {t("hr.assignments.detail.markComplete")}
              </button>
            )}
            {canCancel && (
              <button
                className="btn-secondary flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                {t("common.cancel")}
              </button>
            )}
          </div>
        }
      />

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-neutral-700 text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            {t("hr.assignments.detail.details")}
          </h2>
          {[
            { icon: "person", label: t("hr.assignments.assignee"), value: assignment.assigned_to_user?.name ?? t("hr.assignments.detail.userFallback", { id: assignment.assigned_to }) },
            { icon: "manage_accounts", label: t("hr.assignments.detail.assignedBy"), value: assignment.assigned_by_user?.name ?? t("hr.assignments.detail.userFallback", { id: assignment.assigned_by }) },
            {
              icon: "calendar_today",
              label: t("hr.assignments.dueDate"),
              value: assignment.due_date ? formatDateShort(assignment.due_date) : t("hr.assignments.detail.notSet"),
              highlight: assignment.is_overdue,
            },
            { icon: "timer", label: t("hr.assignments.estHours"), value: assignment.estimated_hours ? `${assignment.estimated_hours}h` : "—" },
            { icon: "hourglass_bottom", label: t("hr.assignments.detail.actualHours"), value: `${assignment.actual_hours}h` },
            { icon: "event", label: t("hr.assignments.detail.created"), value: formatDate(assignment.created_at) },
          ].map(({ icon, label, value, highlight }) => (
            <div key={label} className="flex items-center gap-3">
              <span className="material-symbols-outlined text-[18px] text-neutral-400">{icon}</span>
              <span className="text-sm text-neutral-500 w-28 flex-shrink-0">{label}</span>
              <span className={`text-sm font-medium ${highlight ? "text-red-600" : "text-neutral-800"}`}>{value}</span>
            </div>
          ))}
        </div>

        {assignment.description && (
          <div className="card p-5">
            <h2 className="font-semibold text-neutral-700 text-sm uppercase tracking-wide flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px] text-primary">description</span>
              {t("hr.assignments.description")}
            </h2>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
          </div>
        )}
      </div>

      {/* Progress Updates */}
      <div className="card p-5">
        <h2 className="font-semibold text-neutral-700 text-sm uppercase tracking-wide flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px] text-primary">update</span>
          {t("hr.assignments.detail.progressUpdates")}
          {assignment.updates && assignment.updates.length > 0 && (
            <span className="badge badge-muted ml-1">{assignment.updates.length}</span>
          )}
        </h2>

        {!assignment.updates || assignment.updates.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">{t("hr.assignments.detail.noUpdates")}</p>
        ) : (
          <div className="space-y-4 mb-6">
            {assignment.updates.map((upd: WorkAssignmentUpdate) => (
              <div key={upd.id} className="flex gap-3">
                <div className={`flex-shrink-0 mt-0.5 ${UPDATE_TYPE_COLORS[upd.update_type] ?? "text-neutral-400"}`}>
                  <span className="material-symbols-outlined text-[22px]">
                    {UPDATE_TYPE_ICONS[upd.update_type] ?? "circle"}
                  </span>
                </div>
                <div className="flex-1 pb-4 border-b border-neutral-100 last:border-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-neutral-700">
                      {upd.user?.name ?? t("hr.assignments.detail.system")}
                    </span>
                    <span className="text-xs text-neutral-400">{formatDate(upd.created_at)}</span>
                  </div>
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{upd.content}</p>
                  {upd.hours_logged != null && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-0.5">
                      <span className="material-symbols-outlined text-[13px]">timer</span>
                      {t("hr.assignments.detail.hoursLoggedValue", { hours: upd.hours_logged })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add update form */}
        <form onSubmit={handleAddUpdate} className="border-t border-neutral-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-700">{t("hr.assignments.detail.addUpdate")}</h3>
          {updateError && (
            <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">{updateError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hr-assignment-update-type" className="block text-xs font-medium text-neutral-500 mb-1">{t("hr.assignments.detail.type")}</label>
              <select
                id="hr-assignment-update-type"
                className="form-input"
                value={updateType}
                onChange={(e) => setUpdateType(e.target.value)}
              >
                <option value="comment">{t("hr.assignments.detail.typeComment")}</option>
                <option value="progress">{t("hr.assignments.detail.typeProgress")}</option>
                <option value="blocker">{t("hr.assignments.detail.typeBlocker")}</option>
                <option value="review">{t("hr.assignments.detail.typeReview")}</option>
                <option value="completion">{t("hr.assignments.detail.typeCompletion")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="hr-assignment-hours" className="block text-xs font-medium text-neutral-500 mb-1">{t("hr.assignments.detail.hoursLogged")}</label>
              <input
                id="hr-assignment-hours"
                className="form-input"
                type="number"
                min="0"
                step="0.5"
                placeholder={t("hr.assignments.detail.hoursPlaceholder")}
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="hr-assignment-content" className="block text-xs font-medium text-neutral-500 mb-1">{t("hr.assignments.detail.content")}</label>
            <textarea
              id="hr-assignment-content"
              className="form-input"
              rows={3}
              placeholder={t("hr.assignments.detail.contentPlaceholder")}
              value={updateContent}
              onChange={(e) => setUpdateContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={updateSubmitting}>
              {updateSubmitting ? t("hr.assignments.detail.submitting") : t("hr.assignments.detail.addUpdate")}
            </button>
          </div>
        </form>
      </div>

      {/* Back button */}
      <div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => router.push("/hr/assignments")}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          {t("hr.assignments.detail.back")}
        </button>
      </div>

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">{t("hr.assignments.detail.completeTitle")}</h2>
              <button onClick={() => setShowCompleteModal(false)} aria-label={t("hr.assignments.detail.closeComplete")} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label htmlFor="hr-assignment-completion-notes" className="block text-sm font-medium text-neutral-700 mb-1">
                  {t("hr.assignments.detail.completionNotes")}
                </label>
                <textarea
                  id="hr-assignment-completion-notes"
                  className="form-input"
                  rows={4}
                  placeholder={t("hr.assignments.detail.completionPlaceholder")}
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setShowCompleteModal(false)}>
                  {t("common.cancel")}
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {actionLoading ? t("hr.assignments.detail.completing") : t("hr.assignments.detail.complete")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
