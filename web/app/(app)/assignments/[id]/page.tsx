"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, type Assignment, type AssignmentUpdate } from "@/lib/api";
import { formatDateShort, formatDateRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── Config ──────────────────────────────────────────────────────────────────

const priorityConfig: Record<string, { label: string; cls: string; icon: string }> = {
  low:      { label: "Low",      cls: "badge-muted",   icon: "arrow_downward" },
  medium:   { label: "Medium",   cls: "badge-primary", icon: "drag_handle" },
  high:     { label: "High",     cls: "badge-warning", icon: "arrow_upward" },
  critical: { label: "Critical", cls: "badge-danger",  icon: "priority_high" },
};

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:               { label: "Draft",               cls: "badge-muted",    icon: "edit_note" },
  issued:              { label: "Issued",              cls: "badge-primary",  icon: "send" },
  awaiting_acceptance: { label: "Awaiting Acceptance", cls: "badge-warning",  icon: "pending_actions" },
  accepted:            { label: "Accepted",            cls: "badge-primary",  icon: "thumb_up" },
  active:              { label: "Active",              cls: "badge-success",  icon: "play_circle" },
  at_risk:             { label: "At Risk",             cls: "badge-warning",  icon: "warning" },
  blocked:             { label: "Blocked",             cls: "badge-danger",   icon: "block" },
  delayed:             { label: "Delayed",             cls: "badge-danger",   icon: "hourglass_bottom" },
  completed:           { label: "Completed",           cls: "badge-success",  icon: "check_circle" },
  closed:              { label: "Closed",              cls: "badge-muted",    icon: "lock" },
  returned:            { label: "Returned",            cls: "badge-warning",  icon: "undo" },
  cancelled:           { label: "Cancelled",           cls: "badge-muted",    icon: "cancel" },
};

const updateTypeIcon: Record<string, string> = {
  update:          "edit_note",
  comment:         "chat_bubble",
  feedback:        "rate_review",
  escalation:      "escalator_warning",
  closure_request: "check_circle",
  system:          "info",
};

const updateTypeColor: Record<string, string> = {
  update:          "bg-blue-50 text-blue-600",
  comment:         "bg-neutral-100 text-neutral-600",
  feedback:        "bg-purple-50 text-purple-600",
  escalation:      "bg-red-50 text-red-600",
  closure_request: "bg-green-50 text-green-600",
  system:          "bg-neutral-100 text-neutral-500",
};

// ── Section header helper ───────────────────────────────────────────────────

function SectionIcon({ icon, color, label }: { icon: string; color: string; label: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${color}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <h3 className="text-sm font-semibold text-neutral-700">{label}</h3>
    </div>
  );
}

// ── Update Timeline item ────────────────────────────────────────────────────

function UpdateItem({ u }: { u: AssignmentUpdate }) {
  const icon = updateTypeIcon[u.type] ?? "info";
  const color = updateTypeColor[u.type] ?? "bg-neutral-100 text-neutral-500";
  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mt-0.5 ${color}`}>
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-neutral-100 last:border-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-neutral-700">{u.submitter?.name ?? "System"}</span>
          <span className="text-[10px] text-neutral-400">{formatDateRelative(u.created_at)}</span>
          {u.progress_percent != null && (
            <span className="badge badge-primary text-[10px]">{u.progress_percent}%</span>
          )}
        </div>
        <p className="text-xs text-neutral-600 whitespace-pre-wrap">{u.notes}</p>
        {u.blocker_type && (
          <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">block</span>
            Blocker: {u.blocker_type.replace(/_/g, " ")}
            {u.blocker_details && ` — ${u.blocker_details}`}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  // Modals
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  // Update form state
  const [updateForm, setUpdateForm] = useState({
    notes: "", progress_percent: "", blocker_type: "", blocker_details: "", type: "update",
  });

  // Accept form state
  const [acceptForm, setAcceptForm] = useState({
    decision: "accepted", notes: "", proposed_deadline: "",
  });

  // Close form state
  const [closeForm, setCloseForm] = useState({ notes: "", rating: "" });

  // Cancel reason
  const [cancelReason, setCancelReason] = useState("");

  const { data: assignment, isLoading, isError } = useQuery<Assignment>({
    queryKey: ["assignments", id],
    queryFn: () => assignmentsApi.get(Number(id)).then((r) => r.data),
    staleTime: 30_000,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["assignments", id] });

  const issueMutation     = useMutation({ mutationFn: () => assignmentsApi.issue(Number(id)), onSuccess: invalidate });
  const startMutation     = useMutation({ mutationFn: () => assignmentsApi.start(Number(id)), onSuccess: invalidate });
  const completeMutation  = useMutation({ mutationFn: () => assignmentsApi.complete(Number(id)), onSuccess: invalidate });

  const acceptMutation = useMutation({
    mutationFn: () => assignmentsApi.accept(Number(id), {
      decision: acceptForm.decision as any,
      notes: acceptForm.notes || undefined,
      proposed_deadline: acceptForm.proposed_deadline || undefined,
    }),
    onSuccess: () => { invalidate(); setShowAcceptModal(false); },
  });

  const updateMutation = useMutation({
    mutationFn: () => assignmentsApi.addUpdate(Number(id), {
      type: updateForm.type as any,
      notes: updateForm.notes,
      progress_percent: updateForm.progress_percent ? Number(updateForm.progress_percent) : undefined,
      blocker_type: updateForm.blocker_type as any || undefined,
      blocker_details: updateForm.blocker_details || undefined,
    }),
    onSuccess: () => { invalidate(); setShowUpdateModal(false); setUpdateForm({ notes: "", progress_percent: "", blocker_type: "", blocker_details: "", type: "update" }); },
  });

  const closeMutation = useMutation({
    mutationFn: () => assignmentsApi.close(Number(id), {
      notes: closeForm.notes || undefined,
      rating: closeForm.rating ? Number(closeForm.rating) : undefined,
    }),
    onSuccess: () => { invalidate(); setShowCloseModal(false); },
  });

  const returnMutation = useMutation({
    mutationFn: (reason: string) => assignmentsApi.returnAssignment(Number(id), { reason }),
    onSuccess: invalidate,
  });

  const cancelMutation = useMutation({
    mutationFn: () => assignmentsApi.cancel(Number(id), { reason: cancelReason }),
    onSuccess: () => { invalidate(); setShowCancelModal(false); },
  });

  if (isLoading) {
    return (
      <div className="max-w-3xl space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="card p-5 animate-pulse">
            <div className="h-4 bg-neutral-200 rounded w-1/3 mb-3" />
            <div className="h-3 bg-neutral-100 rounded w-2/3" />
          </div>
        ))}
      </div>
    );
  }

  if (isError || !assignment) {
    return (
      <div className="card p-10 text-center max-w-lg">
        <span className="material-symbols-outlined text-4xl text-red-400 block">error_outline</span>
        <p className="mt-3 text-sm text-neutral-600">Failed to load assignment.</p>
        <Link href="/assignments" className="btn-secondary mt-4 inline-flex">Back to Assignments</Link>
      </div>
    );
  }

  const s = statusConfig[assignment.status] ?? { label: assignment.status, cls: "badge-muted", icon: "info" };
  const p = priorityConfig[assignment.priority] ?? { label: assignment.priority, cls: "badge-muted", icon: "drag_handle" };
  const isOverdue = !["closed", "cancelled"].includes(assignment.status) && new Date(assignment.due_date) < new Date();

  return (
    <div className="max-w-3xl space-y-5">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-neutral-500">
        <Link href="/assignments" className="hover:text-primary">Assignments</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 font-medium truncate max-w-xs">{assignment.title}</span>
      </nav>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="text-xs font-mono text-neutral-400">{assignment.reference_number}</span>
              <span className={`badge ${s.cls}`}>
                <span className="material-symbols-outlined text-[12px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
                {s.label}
              </span>
              <span className={`badge ${p.cls}`}>{p.label} Priority</span>
              {isOverdue && <span className="badge badge-danger">Overdue</span>}
              {assignment.is_confidential && (
                <span className="badge badge-muted">
                  <span className="material-symbols-outlined text-[12px] mr-1">lock</span>
                  Confidential
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-neutral-900">{assignment.title}</h1>
            <p className="text-sm text-neutral-500 mt-1">{assignment.description}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>Progress</span>
            <span className="font-semibold text-neutral-700">{assignment.progress_percent}%</span>
          </div>
          <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                assignment.progress_percent >= 100 ? "bg-green-500" :
                assignment.status === "blocked" ? "bg-red-400" :
                assignment.status === "at_risk" ? "bg-amber-400" : "bg-primary"
              )}
              style={{ width: `${assignment.progress_percent}%` }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-wrap gap-2">
          {assignment.status === "draft" && (
            <button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || !assignment.assigned_to}
              className="btn-primary disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              Issue Assignment
            </button>
          )}
          {["issued", "awaiting_acceptance"].includes(assignment.status) && (
            <button onClick={() => setShowAcceptModal(true)} className="btn-primary">
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              Respond to Assignment
            </button>
          )}
          {assignment.status === "accepted" && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-primary disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              Start Working
            </button>
          )}
          {["active", "at_risk", "blocked", "delayed", "accepted"].includes(assignment.status) && (
            <>
              <button onClick={() => setShowUpdateModal(true)} className="btn-secondary">
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                Post Update
              </button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="btn-secondary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                Submit for Closure
              </button>
            </>
          )}
          {assignment.status === "completed" && (
            <>
              <button onClick={() => setShowCloseModal(true)} className="btn-primary">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Close Assignment
              </button>
              <button
                onClick={() => returnMutation.mutate("Returned for further revision.")}
                disabled={returnMutation.isPending}
                className="btn-secondary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                Return
              </button>
            </>
          )}
          {!["closed", "cancelled"].includes(assignment.status) && (
            <button onClick={() => setShowCancelModal(true)} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50">
              <span className="material-symbols-outlined text-[16px]">cancel</span>
              Cancel
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Details */}
        <div className="card p-5">
          <SectionIcon icon="info" color="bg-blue-50 text-blue-600" label="Assignment Details" />
          <div className="space-y-3 text-sm">
            <InfoRow icon="person" label="Assignee" value={assignment.assignee?.name ?? "—"} />
            <InfoRow icon="person_add" label="Created By" value={assignment.creator?.name ?? "—"} />
            <InfoRow icon="corporate_fare" label="Department" value={assignment.department?.name ?? "—"} />
            <InfoRow icon="calendar_today" label="Due Date" value={formatDateShort(assignment.due_date)} alert={isOverdue} />
            {assignment.start_date && (
              <InfoRow icon="play_arrow" label="Start Date" value={formatDateShort(assignment.start_date)} />
            )}
            {assignment.checkin_frequency && (
              <InfoRow icon="repeat" label="Check-in" value={assignment.checkin_frequency} />
            )}
            <InfoRow icon="category" label="Type" value={assignment.type} />
          </div>
        </div>

        {/* Objective & Output */}
        {(assignment.objective || assignment.expected_output) && (
          <div className="card p-5">
            <SectionIcon icon="flag" color="bg-purple-50 text-purple-600" label="Objective & Output" />
            {assignment.objective && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Objective</p>
                <p className="text-sm text-neutral-700">{assignment.objective}</p>
              </div>
            )}
            {assignment.expected_output && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">Expected Output</p>
                <p className="text-sm text-neutral-700">{assignment.expected_output}</p>
              </div>
            )}
          </div>
        )}

        {/* Blocker */}
        {assignment.blocker_type && (
          <div className="card p-5 border-red-200 bg-red-50">
            <SectionIcon icon="block" color="bg-red-100 text-red-600" label="Active Blocker" />
            <p className="text-sm font-semibold text-red-700 mb-1">
              {assignment.blocker_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
            {assignment.blocker_details && (
              <p className="text-sm text-red-600">{assignment.blocker_details}</p>
            )}
          </div>
        )}

        {/* Acceptance info */}
        {assignment.acceptance_decision && (
          <div className="card p-5">
            <SectionIcon icon="task_alt" color="bg-green-50 text-green-600" label="Acceptance Response" />
            <div className="space-y-2 text-sm">
              <InfoRow icon="check" label="Decision" value={assignment.acceptance_decision.replace(/_/g, " ")} />
              {assignment.acceptance_notes && (
                <InfoRow icon="notes" label="Notes" value={assignment.acceptance_notes} />
              )}
              {assignment.proposed_deadline && (
                <InfoRow icon="event" label="Proposed Deadline" value={formatDateShort(assignment.proposed_deadline)} />
              )}
            </div>
          </div>
        )}

        {/* Closure */}
        {assignment.status === "closed" && (
          <div className="card p-5">
            <SectionIcon icon="lock" color="bg-neutral-100 text-neutral-600" label="Closure" />
            <div className="space-y-2 text-sm">
              {assignment.closed_at && (
                <InfoRow icon="calendar_today" label="Closed On" value={formatDateShort(assignment.closed_at)} />
              )}
              {assignment.completion_rating && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-neutral-400">star</span>
                  <span className="text-neutral-500 w-20">Rating</span>
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className="material-symbols-outlined text-[14px]"
                        style={{ color: i < (assignment.completion_rating ?? 0) ? "#f59e0b" : "#d1d5db", fontVariationSettings: "'FILL' 1" }}
                      >star</span>
                    ))}
                  </span>
                </div>
              )}
              {assignment.closure_notes && (
                <InfoRow icon="notes" label="Notes" value={assignment.closure_notes} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Update Timeline */}
      <div className="card p-5">
        <SectionIcon icon="history" color="bg-neutral-100 text-neutral-600" label="Activity Timeline" />
        {(assignment.updates?.length ?? 0) > 0 ? (
          <div className="space-y-0">
            {assignment.updates!.map((u) => <UpdateItem key={u.id} u={u} />)}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 text-center py-4">No updates yet.</p>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Post Update Modal */}
      {showUpdateModal && (
        <Modal title="Post Update" onClose={() => setShowUpdateModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Update Type</label>
              <select
                value={updateForm.type}
                onChange={(e) => setUpdateForm((f) => ({ ...f, type: e.target.value }))}
                className="form-input"
              >
                <option value="update">Progress Update</option>
                <option value="comment">Comment</option>
                <option value="feedback">Feedback</option>
                <option value="escalation">Escalation</option>
                <option value="closure_request">Closure Request</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Progress %</label>
              <input
                type="number"
                min={0}
                max={100}
                value={updateForm.progress_percent}
                onChange={(e) => setUpdateForm((f) => ({ ...f, progress_percent: e.target.value }))}
                placeholder={`Current: ${assignment.progress_percent}%`}
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes <span className="text-red-400">*</span></label>
              <textarea
                rows={4}
                value={updateForm.notes}
                onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Describe your progress, issues, or feedback…"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Blocker (if any)</label>
              <select
                value={updateForm.blocker_type}
                onChange={(e) => setUpdateForm((f) => ({ ...f, blocker_type: e.target.value }))}
                className="form-input"
              >
                <option value="">— No blocker —</option>
                <option value="awaiting_approval">Awaiting Approval</option>
                <option value="awaiting_funds">Awaiting Funds</option>
                <option value="awaiting_information">Awaiting Information</option>
                <option value="external_dependency">External Dependency</option>
              </select>
            </div>
            {updateForm.blocker_type && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Blocker Details</label>
                <textarea
                  rows={2}
                  value={updateForm.blocker_details}
                  onChange={(e) => setUpdateForm((f) => ({ ...f, blocker_details: e.target.value }))}
                  className="form-input"
                />
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => updateMutation.mutate()}
                disabled={!updateForm.notes || updateMutation.isPending}
                className="btn-primary disabled:opacity-60"
              >
                {updateMutation.isPending ? "Posting…" : "Post Update"}
              </button>
              <button onClick={() => setShowUpdateModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <Modal title="Respond to Assignment" onClose={() => setShowAcceptModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Decision</label>
              <select
                value={acceptForm.decision}
                onChange={(e) => setAcceptForm((f) => ({ ...f, decision: e.target.value }))}
                className="form-input"
              >
                <option value="accepted">Accept</option>
                <option value="clarification_requested">Request Clarification</option>
                <option value="deadline_proposed">Propose New Deadline</option>
                <option value="rejected">Decline</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Notes</label>
              <textarea
                rows={3}
                value={acceptForm.notes}
                onChange={(e) => setAcceptForm((f) => ({ ...f, notes: e.target.value }))}
                className="form-input"
              />
            </div>
            {acceptForm.decision === "deadline_proposed" && (
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Proposed Deadline</label>
                <input
                  type="date"
                  value={acceptForm.proposed_deadline}
                  onChange={(e) => setAcceptForm((f) => ({ ...f, proposed_deadline: e.target.value }))}
                  className="form-input"
                />
              </div>
            )}
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
                className="btn-primary disabled:opacity-60"
              >
                {acceptMutation.isPending ? "Submitting…" : "Submit Response"}
              </button>
              <button onClick={() => setShowAcceptModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <Modal title="Close Assignment" onClose={() => setShowCloseModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Closure Notes</label>
              <textarea
                rows={3}
                value={closeForm.notes}
                onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Summary of outcome, key observations…"
                className="form-input"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Performance Rating (1–5)</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setCloseForm((f) => ({ ...f, rating: String(n) }))}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all",
                      closeForm.rating === String(n)
                        ? "border-primary bg-primary text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-primary hover:text-primary"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                className="btn-primary disabled:opacity-60"
              >
                {closeMutation.isPending ? "Closing…" : "Close Assignment"}
              </button>
              <button onClick={() => setShowCloseModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <Modal title="Cancel Assignment" onClose={() => setShowCancelModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">Are you sure you want to cancel this assignment? This action cannot be undone.</p>
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">Reason (optional)</label>
              <textarea
                rows={3}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => cancelMutation.mutate()}
                disabled={cancelMutation.isPending}
                className="btn-primary bg-red-600 hover:bg-red-700 border-red-600 disabled:opacity-60"
              >
                {cancelMutation.isPending ? "Cancelling…" : "Confirm Cancel"}
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary">Keep Assignment</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, alert }: { icon: string; label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="material-symbols-outlined text-[14px] text-neutral-400 mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-neutral-500 w-28 flex-shrink-0 text-xs">{label}</span>
      <span className={cn("flex-1 text-xs font-medium", alert ? "text-red-500" : "text-neutral-800")}>{value}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
