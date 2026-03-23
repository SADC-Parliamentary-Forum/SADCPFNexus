"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { workAssignmentsApi, WorkAssignment, WorkAssignmentUpdate } from "@/lib/api";
import { formatDate, formatDateShort } from "@/lib/utils";

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

function statusLabel(status: WorkAssignment["status"]) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
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
      setError("Failed to load assignment.");
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
    } catch {
      // ignore
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
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!assignment) return;
    if (!confirm("Cancel this assignment?")) return;
    setActionLoading(true);
    try {
      const res = await workAssignmentsApi.update(assignment.id, { status: "cancelled" });
      setAssignment(res.data);
    } catch {
      // ignore
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!updateContent.trim()) {
      setUpdateError("Content is required.");
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
      await load();
    } catch {
      setUpdateError("Failed to submit update.");
    } finally {
      setUpdateSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-4">
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
        {error ?? "Assignment not found."}
        <div className="mt-4">
          <button className="btn-secondary" onClick={() => router.push("/hr/assignments")}>
            Back to Assignments
          </button>
        </div>
      </div>
    );
  }

  const canStart = assignment.status === "assigned" || assignment.status === "draft";
  const canComplete = assignment.status === "in_progress" || assignment.status === "pending_review";
  const canCancel = !["completed", "cancelled"].includes(assignment.status);

  return (
    <div className="p-6 space-y-5 max-w-4xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/hr" className="hover:text-primary">HR</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <Link href="/hr/assignments" className="hover:text-primary">Assignments</Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-700 font-medium truncate max-w-xs">{assignment.title}</span>
      </nav>

      {/* Header card */}
      <div className="card p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`badge ${priorityBadge(assignment.priority)}`}>
                {assignment.priority.charAt(0).toUpperCase() + assignment.priority.slice(1)} Priority
              </span>
              <span className={`badge ${statusBadge(assignment.status)}`}>
                {statusLabel(assignment.status)}
              </span>
              {assignment.is_overdue && (
                <span className="badge badge-danger flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">schedule</span>
                  Overdue
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-neutral-800">{assignment.title}</h1>
          </div>
          <div className="flex flex-wrap gap-2 flex-shrink-0">
            {canStart && (
              <button className="btn-primary flex items-center gap-1" onClick={handleStart} disabled={actionLoading}>
                <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                Start
              </button>
            )}
            {canComplete && (
              <button
                className="btn-primary flex items-center gap-1"
                onClick={() => setShowCompleteModal(true)}
                disabled={actionLoading}
              >
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                Mark Complete
              </button>
            )}
            {canCancel && (
              <button
                className="btn-secondary flex items-center gap-1 text-red-600 border-red-200 hover:bg-red-50"
                onClick={handleCancel}
                disabled={actionLoading}
              >
                <span className="material-symbols-outlined text-[18px]">cancel</span>
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold text-neutral-700 text-sm uppercase tracking-wide flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">info</span>
            Assignment Details
          </h2>
          {[
            { icon: "person", label: "Assignee", value: assignment.assigned_to_user?.name ?? `User #${assignment.assigned_to}` },
            { icon: "manage_accounts", label: "Assigned By", value: assignment.assigned_by_user?.name ?? `User #${assignment.assigned_by}` },
            {
              icon: "calendar_today",
              label: "Due Date",
              value: assignment.due_date ? formatDateShort(assignment.due_date) : "Not set",
              highlight: assignment.is_overdue,
            },
            { icon: "timer", label: "Est. Hours", value: assignment.estimated_hours ? `${assignment.estimated_hours}h` : "—" },
            { icon: "hourglass_bottom", label: "Actual Hours", value: `${assignment.actual_hours}h` },
            { icon: "event", label: "Created", value: formatDate(assignment.created_at) },
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
              Description
            </h2>
            <p className="text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{assignment.description}</p>
          </div>
        )}
      </div>

      {/* Progress Updates */}
      <div className="card p-5">
        <h2 className="font-semibold text-neutral-700 text-sm uppercase tracking-wide flex items-center gap-2 mb-4">
          <span className="material-symbols-outlined text-[18px] text-primary">update</span>
          Progress Updates
          {assignment.updates && assignment.updates.length > 0 && (
            <span className="badge badge-muted ml-1">{assignment.updates.length}</span>
          )}
        </h2>

        {!assignment.updates || assignment.updates.length === 0 ? (
          <p className="text-sm text-neutral-400 text-center py-4">No updates yet. Add the first update below.</p>
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
                      {upd.user?.name ?? "System"}
                    </span>
                    <span className="text-xs text-neutral-400">{formatDate(upd.created_at)}</span>
                  </div>
                  <p className="text-sm text-neutral-700 whitespace-pre-wrap">{upd.content}</p>
                  {upd.hours_logged != null && (
                    <span className="inline-flex items-center gap-1 mt-1 text-xs text-amber-600 bg-amber-50 rounded px-2 py-0.5">
                      <span className="material-symbols-outlined text-[13px]">timer</span>
                      {upd.hours_logged}h logged
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Add update form */}
        <form onSubmit={handleAddUpdate} className="border-t border-neutral-100 pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-neutral-700">Add Update</h3>
          {updateError && (
            <div className="bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">{updateError}</div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Type</label>
              <select
                className="form-input"
                value={updateType}
                onChange={(e) => setUpdateType(e.target.value)}
              >
                <option value="comment">Comment</option>
                <option value="progress">Progress</option>
                <option value="blocker">Blocker</option>
                <option value="review">Review</option>
                <option value="completion">Completion</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 mb-1">Hours Logged</label>
              <input
                className="form-input"
                type="number"
                min="0"
                step="0.5"
                placeholder="e.g. 2.5"
                value={hoursLogged}
                onChange={(e) => setHoursLogged(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-neutral-500 mb-1">Content *</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Describe the update, progress, or blocker..."
              value={updateContent}
              onChange={(e) => setUpdateContent(e.target.value)}
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={updateSubmitting}>
              {updateSubmitting ? "Submitting..." : "Add Update"}
            </button>
          </div>
        </form>
      </div>

      {/* Back button */}
      <div>
        <button className="btn-secondary flex items-center gap-2" onClick={() => router.push("/hr/assignments")}>
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Assignments
        </button>
      </div>

      {/* Complete Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <h2 className="font-semibold text-neutral-800">Mark Assignment Complete</h2>
              <button onClick={() => setShowCompleteModal(false)} className="text-neutral-400 hover:text-neutral-600">
                <span className="material-symbols-outlined text-[22px]">close</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Completion Notes (optional)
                </label>
                <textarea
                  className="form-input"
                  rows={4}
                  placeholder="Summarize what was completed, any outcomes or follow-up items..."
                  value={completionNotes}
                  onChange={(e) => setCompletionNotes(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button className="btn-secondary" onClick={() => setShowCompleteModal(false)}>
                  Cancel
                </button>
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleComplete}
                  disabled={actionLoading}
                >
                  <span className="material-symbols-outlined text-[18px]">check_circle</span>
                  {actionLoading ? "Completing..." : "Complete Assignment"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
