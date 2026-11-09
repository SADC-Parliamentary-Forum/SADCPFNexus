"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, tenantUsersApi, type Assignment, type AssignmentUpdate, type TenantUserOption } from "@/lib/api";
import { formatDateShort, formatDateRelative } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ── Config ──────────────────────────────────────────────────────────────────

const priorityConfig: Record<string, { label: string; cls: string; icon: string }> = {
  low:      { label: "assignments.priority.low",      cls: "badge-muted",   icon: "arrow_downward" },
  medium:   { label: "assignments.priority.medium",   cls: "badge-primary", icon: "drag_handle" },
  high:     { label: "assignments.priority.high",     cls: "badge-warning", icon: "arrow_upward" },
  critical: { label: "assignments.priority.critical", cls: "badge-danger",  icon: "priority_high" },
};

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:               { label: "assignments.status.draft",               cls: "badge-muted",    icon: "edit_note" },
  issued:              { label: "assignments.status.issued",              cls: "badge-primary",  icon: "send" },
  awaiting_acceptance: { label: "assignments.status.awaiting_acceptance", cls: "badge-warning",  icon: "pending_actions" },
  accepted:            { label: "assignments.status.accepted",            cls: "badge-primary",  icon: "thumb_up" },
  active:              { label: "assignments.status.active",              cls: "badge-success",  icon: "play_circle" },
  at_risk:             { label: "assignments.status.at_risk",             cls: "badge-warning",  icon: "warning" },
  blocked:             { label: "assignments.status.blocked",             cls: "badge-danger",   icon: "block" },
  delayed:             { label: "assignments.status.delayed",             cls: "badge-danger",   icon: "hourglass_bottom" },
  completed:           { label: "assignments.status.completed",           cls: "badge-success",  icon: "check_circle" },
  closed:              { label: "assignments.status.closed",              cls: "badge-muted",    icon: "lock" },
  returned:            { label: "assignments.status.returned",            cls: "badge-warning",  icon: "undo" },
  cancelled:           { label: "assignments.status.cancelled",           cls: "badge-muted",    icon: "cancel" },
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
  feedback:        "bg-primary/10 text-primary",
  escalation:      "bg-red-50 text-red-600",
  closure_request: "bg-green-50 text-green-600",
  system:          "bg-neutral-100 text-neutral-500",
};

const BLOCKER_LOWER_KEYS: Record<string, string> = {
  awaiting_approval: "assignments.blockerLower.awaiting_approval",
  awaiting_funds: "assignments.blockerLower.awaiting_funds",
  awaiting_information: "assignments.blockerLower.awaiting_information",
  external_dependency: "assignments.blockerLower.external_dependency",
};

const BLOCKER_KEYS: Record<string, string> = {
  awaiting_approval: "assignments.blocker.awaiting_approval",
  awaiting_funds: "assignments.blocker.awaiting_funds",
  awaiting_information: "assignments.blocker.awaiting_information",
  external_dependency: "assignments.blocker.external_dependency",
};

const DECISION_KEYS: Record<string, string> = {
  accepted: "assignments.detail.decisionValue.accepted",
  clarification_requested: "assignments.detail.decisionValue.clarification_requested",
  deadline_proposed: "assignments.detail.decisionValue.deadline_proposed",
  rejected: "assignments.detail.decisionValue.rejected",
};

const FREQUENCY_KEYS: Record<string, string> = {
  daily: "assignments.frequency.daily",
  weekly: "assignments.frequency.weekly",
  biweekly: "assignments.frequency.biweekly",
  monthly: "assignments.frequency.monthly",
};

const TYPE_KEYS: Record<string, string> = {
  individual: "assignments.type.individual",
  sector: "assignments.type.sector",
  collaborative: "assignments.type.collaborative",
};

/** Translates a known enum value; unknown values from the server fall back to readable text. */
function enumLabel(t: (key: string) => string, keys: Record<string, string>, value: string): string {
  return keys[value] ? t(keys[value]) : value.replace(/_/g, " ");
}

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
  const { t } = useI18n();
  const icon = updateTypeIcon[u.type] ?? "info";
  const color = updateTypeColor[u.type] ?? "bg-neutral-100 text-neutral-500";
  return (
    <div className="flex gap-3">
      <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full mt-0.5 ${color}`}>
        <span className="material-symbols-outlined text-[14px]">{icon}</span>
      </div>
      <div className="flex-1 min-w-0 pb-4 border-b border-neutral-100 last:border-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xs font-semibold text-neutral-700">{u.submitter?.name ?? t("assignments.detail.system")}</span>
          <span className="text-[10px] text-neutral-400">{formatDateRelative(u.created_at)}</span>
          {u.progress_percent != null && (
            <span className="badge badge-primary text-[10px]">{u.progress_percent}%</span>
          )}
        </div>
        <p className="text-xs text-neutral-600 whitespace-pre-wrap">{u.notes}</p>
        {u.blocker_type && (
          <p className="mt-1 text-[10px] text-red-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-[12px]">block</span>
            {t("assignments.detail.blockerPrefix", { type: enumLabel(t, BLOCKER_LOWER_KEYS, u.blocker_type) })}
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
  const { t } = useI18n();

  // Modals
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [showDueDateModal, setShowDueDateModal] = useState(false);
  const [showChecklistModal, setShowChecklistModal] = useState(false);
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const { success, error: showErrorToast } = useToast();

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
  const [blockForm, setBlockForm] = useState({ blocker_type: "awaiting_information", blocker_owner_id: "", blocker_details: "" });
  const [verifyForm, setVerifyForm] = useState({ decision: "accepted", comments: "" });
  const [reassignForm, setReassignForm] = useState({ assigned_to: "", reason: "" });
  const [dueDateForm, setDueDateForm] = useState({ due_date: "", reason: "" });
  const [checklistTitle, setChecklistTitle] = useState("");
  const [depId, setDepId] = useState("");

  useEffect(() => {
    tenantUsersApi.list().then((r) => setUsers(r.data.data ?? [])).catch(() => {});
  }, []);

  const { data: assignment, isLoading, isError } = useQuery<Assignment>({
    queryKey: ["assignments", id],
    queryFn: () => assignmentsApi.get(Number(id)).then((r) => r.data),
    staleTime: 30_000,
  });

  const numericId = Number(id);
  const depsQuery = useQuery({
    queryKey: ["assignments", id, "dependencies"],
    enabled: Number.isFinite(numericId) && numericId > 0,
    queryFn: () => assignmentsApi.dependencies(numericId).then((r) => r.data.data),
  });
  const hoursQuery = useQuery({
    queryKey: ["assignments", id, "timesheet-hours"],
    enabled: Number.isFinite(numericId) && numericId > 0,
    queryFn: () => assignmentsApi.timesheetHours(numericId).then((r) => r.data.data),
  });
  const peersQuery = useQuery({
    queryKey: ["assignments", "dep-peers"],
    queryFn: async () => {
      const res = await assignmentsApi.list({ per_page: "50" });
      const body = res.data as { data?: Assignment[] };
      return body.data ?? [];
    },
  });
  const addDep = useMutation({
    mutationFn: () =>
      assignmentsApi.addDependency(numericId, { depends_on_assignment_id: Number(depId) }),
    onSuccess: () => {
      setDepId("");
      qc.invalidateQueries({ queryKey: ["assignments", id, "dependencies"] });
    },
  });
  const removeDep = useMutation({
    mutationFn: (dependencyId: number) => assignmentsApi.removeDependency(numericId, dependencyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["assignments", id, "dependencies"] }),
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

  const blockMutation = useMutation({
    mutationFn: () => assignmentsApi.block(Number(id), {
      blocker_type: blockForm.blocker_type,
      blocker_owner_id: Number(blockForm.blocker_owner_id),
      blocker_details: blockForm.blocker_details || undefined,
    }),
    onSuccess: () => { invalidate(); setShowBlockModal(false); },
  });

  const unblockMutation = useMutation({
    mutationFn: () => assignmentsApi.unblock(Number(id)),
    onSuccess: invalidate,
  });

  const verifyMutation = useMutation({
    mutationFn: () => assignmentsApi.verify(Number(id), {
      decision: verifyForm.decision,
      comments: verifyForm.comments || undefined,
    }),
    onSuccess: () => { invalidate(); setShowVerifyModal(false); },
  });

  const reassignMutation = useMutation({
    mutationFn: () => assignmentsApi.reassign(Number(id), {
      assigned_to: Number(reassignForm.assigned_to),
      reason: reassignForm.reason,
    }),
    onSuccess: () => { invalidate(); setShowReassignModal(false); setReassignForm({ assigned_to: "", reason: "" }); },
  });

  const changeDueDateMutation = useMutation({
    mutationFn: () => assignmentsApi.changeDueDate(Number(id), {
      due_date: dueDateForm.due_date,
      reason: dueDateForm.reason.trim(),
    }),
    onSuccess: () => {
      invalidate();
      setShowDueDateModal(false);
      setDueDateForm({ due_date: "", reason: "" });
      success(t("assignments.detail.toast.dueDateUpdated"));
    },
    onError: () => showErrorToast(t("assignments.detail.toast.dueDateFailed")),
  });

  const claimMutation = useMutation({
    mutationFn: () => assignmentsApi.claim(Number(id)),
    onSuccess: () => {
      invalidate();
      success(t("assignments.detail.toast.claimed"));
    },
    onError: () => showErrorToast(t("assignments.detail.toast.claimFailed")),
  });

  const checklistMutation = useMutation({
    mutationFn: () => assignmentsApi.addChecklistItem(Number(id), { title: checklistTitle.trim() }),
    onSuccess: () => { invalidate(); setShowChecklistModal(false); setChecklistTitle(""); },
  });

  const toggleChecklistMutation = useMutation({
    mutationFn: ({ itemId, completed }: { itemId: number; completed: boolean }) =>
      assignmentsApi.toggleChecklistItem(Number(id), itemId, completed),
    onSuccess: invalidate,
  });

  if (isLoading) {
    return (
      <div className="w-full min-w-0 space-y-6">
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
        <p className="mt-3 text-sm text-neutral-600">{t("assignments.detail.loadFailed")}</p>
        <Link href="/assignments" className="btn-secondary mt-4 inline-flex">{t("assignments.detail.back")}</Link>
      </div>
    );
  }

  const sc = statusConfig[assignment.status];
  const pc = priorityConfig[assignment.priority];
  const s = sc ? { ...sc, label: t(sc.label) } : { label: assignment.status, cls: "badge-muted", icon: "info" };
  const p = pc ? { ...pc, label: t(pc.label) } : { label: assignment.priority, cls: "badge-muted", icon: "drag_handle" };
  const isOverdue = !["closed", "cancelled"].includes(assignment.status) && new Date(assignment.due_date) < new Date();

  return (
    <div className="w-full min-w-0 space-y-5">
      <WorkflowStatusBanner
        status={assignment.status}
        currentStage={null}
        currentHolder={assignment.assignee?.name ?? null}
      />

      <ModulePageHeader
        title={assignment.title}
        subtitle={assignment.description}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.assignments", href: "/assignments" },
              { label: assignment.reference_number },
            ]}
          />
        }
        meta={
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${s.cls}`}>
              <span className="material-symbols-outlined text-[12px] mr-1" style={{ fontVariationSettings: "'FILL' 1" }}>{s.icon}</span>
              {s.label}
            </span>
            <span className={`badge ${p.cls}`}>{t("assignments.detail.priorityBadge", { priority: p.label })}</span>
            {isOverdue && <span className="badge badge-danger">{t("assignments.overdueBadge")}</span>}
            {assignment.is_confidential && (
              <span className="badge badge-muted">
                <span className="material-symbols-outlined text-[12px] mr-1">lock</span>
                {t("assignments.detail.confidential")}
              </span>
            )}
          </div>
        }
      />

      {/* Header card */}
      <div className="card p-6">

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
            <span>{t("assignments.detail.progress")}</span>
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
          {!assignment.assigned_to && (
            <button
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending || !assignment.department_id}
              title={!assignment.department_id ? t("assignments.detail.claimOnlyQueue") : t("assignments.detail.claimThis")}
              className="btn-secondary disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">handshake</span>
              {t("assignments.detail.claim")}
            </button>
          )}
          {assignment.status === "draft" && (
            <button
              onClick={() => issueMutation.mutate()}
              disabled={issueMutation.isPending || !assignment.assigned_to}
              className="btn-primary disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">send</span>
              {t("assignments.detail.issue")}
            </button>
          )}
          {["issued", "awaiting_acceptance"].includes(assignment.status) && (
            <button onClick={() => setShowAcceptModal(true)} className="btn-primary">
              <span className="material-symbols-outlined text-[16px]">task_alt</span>
              {t("assignments.detail.respond")}
            </button>
          )}
          {assignment.status === "accepted" && (
            <button
              onClick={() => startMutation.mutate()}
              disabled={startMutation.isPending}
              className="btn-primary disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">play_arrow</span>
              {t("assignments.detail.start")}
            </button>
          )}
          {["active", "at_risk", "blocked", "delayed", "accepted"].includes(assignment.status) && (
            <>
              <button onClick={() => setShowUpdateModal(true)} className="btn-secondary">
                <span className="material-symbols-outlined text-[16px]">edit_note</span>
                {t("assignments.detail.postUpdate")}
              </button>
              {assignment.status !== "blocked" ? (
                <button onClick={() => setShowBlockModal(true)} className="btn-secondary text-red-600 border-red-200">
                  <span className="material-symbols-outlined text-[16px]">block</span>
                  {t("assignments.detail.markBlocked")}
                </button>
              ) : (
                <button
                  onClick={() => unblockMutation.mutate()}
                  disabled={unblockMutation.isPending}
                  className="btn-secondary disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">lock_open</span>
                  {t("assignments.detail.unblock")}
                </button>
              )}
              <button onClick={() => setShowReassignModal(true)} className="btn-secondary">
                <span className="material-symbols-outlined text-[16px]">swap_horiz</span>
                {t("assignments.detail.reassign")}
              </button>
              <button onClick={() => setShowChecklistModal(true)} className="btn-secondary">
                <span className="material-symbols-outlined text-[16px]">checklist</span>
                {t("assignments.detail.addChecklistItem")}
              </button>
              <button
                onClick={() => completeMutation.mutate()}
                disabled={completeMutation.isPending}
                className="btn-secondary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                {t("assignments.detail.submitForClosure")}
              </button>
            </>
          )}
          {assignment.status === "completed" && (
            <>
              <button onClick={() => setShowVerifyModal(true)} className="btn-primary">
                <span className="material-symbols-outlined text-[16px]">verified</span>
                {t("assignments.detail.verify")}
              </button>
              <button onClick={() => setShowCloseModal(true)} className="btn-secondary">
                <span className="material-symbols-outlined text-[16px]">lock</span>
                {t("assignments.detail.closeAssignment")}
              </button>
              <button
                onClick={() => returnMutation.mutate("Returned for further revision.")}
                disabled={returnMutation.isPending}
                className="btn-secondary disabled:opacity-60"
              >
                <span className="material-symbols-outlined text-[16px]">undo</span>
                {t("common.return")}
              </button>
            </>
          )}
          {!["closed", "cancelled"].includes(assignment.status) && (
            <>
              <button
                onClick={() => {
                  setDueDateForm({
                    due_date: assignment.due_date ? String(assignment.due_date).slice(0, 10) : "",
                    reason: "",
                  });
                  setShowDueDateModal(true);
                }}
                className="btn-secondary"
              >
                <span className="material-symbols-outlined text-[16px]">event</span>
                {t("assignments.detail.changeDueDate")}
              </button>
              <button onClick={() => setShowCancelModal(true)} className="btn-secondary text-red-500 border-red-200 hover:bg-red-50">
                <span className="material-symbols-outlined text-[16px]">cancel</span>
                {t("common.cancel")}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Details */}
        <div className="card p-5">
          <SectionIcon icon="info" color="bg-blue-50 text-blue-600" label={t("assignments.detail.detailsTitle")} />
          <div className="space-y-3 text-sm">
            <InfoRow icon="person" label={t("assignments.capacity.assignee")} value={assignment.assignee?.name ?? "—"} />
            <InfoRow icon="person_add" label={t("assignments.detail.createdBy")} value={assignment.creator?.name ?? "—"} />
            <InfoRow icon="corporate_fare" label={t("assignments.detail.department")} value={assignment.department?.name ?? "—"} />
            <InfoRow icon="calendar_today" label={t("assignments.create.dueDate")} value={formatDateShort(assignment.due_date)} alert={isOverdue} />
            {assignment.start_date && (
              <InfoRow icon="play_arrow" label={t("assignments.create.startDate")} value={formatDateShort(assignment.start_date)} />
            )}
            {assignment.checkin_frequency && (
              <InfoRow icon="repeat" label={t("assignments.detail.checkin")} value={enumLabel(t, FREQUENCY_KEYS, assignment.checkin_frequency)} />
            )}
            <InfoRow icon="category" label={t("assignments.detail.type")} value={enumLabel(t, TYPE_KEYS, assignment.type)} />
          </div>
        </div>

        <div className="card p-5" data-testid="assignment-timesheet-hours">
          <SectionIcon icon="schedule" color="bg-sky-50 text-sky-700" label={t("assignments.detail.timesheetHours")} />
          <p className="mb-2 text-xs text-neutral-500">
            {t("assignments.detail.timesheetHint")}
          </p>
          <p className="text-sm">
            {hoursQuery.data?.estimated_hours != null
              ? t("assignments.detail.loggedOfEstimated", { logged: hoursQuery.data?.logged_hours ?? 0, estimated: hoursQuery.data.estimated_hours })
              : t("assignments.detail.logged", { logged: hoursQuery.data?.logged_hours ?? 0 })}
          </p>
        </div>

        <div className="card p-5">
          <SectionIcon icon="account_tree" color="bg-amber-50 text-amber-700" label={t("assignments.detail.dependencies")} />
          <p className="mb-3 text-xs text-neutral-500">
            {t("assignments.detail.dependenciesHint")}
          </p>
          <ul className="mb-3 space-y-2 text-sm">
            {(depsQuery.data?.blocked_by ?? []).map((raw) => {
              const row = raw as {
                id?: number;
                depends_on_assignment_id?: number;
                assignment?: { id?: number; title?: string; reference_number?: string };
              };
              const linked = row.assignment;
              return (
                <li key={String(row.id)} className="flex items-center justify-between gap-2">
                  <Link href={`/assignments/${row.depends_on_assignment_id}`} className="btn-secondary text-xs py-1 px-2">
                    {linked?.title ?? t("assignments.detail.assignmentNumber", { id: String(row.depends_on_assignment_id) })}
                    {linked?.reference_number ? ` · ${linked.reference_number}` : ""}
                  </Link>
                  <button
                    type="button"
                    className="btn-secondary text-xs py-1 px-2 text-red-700"
                    onClick={() => removeDep.mutate(Number(row.id))}
                    disabled={removeDep.isPending}
                  >
                    {t("assignments.detail.remove")}
                  </button>
                </li>
              );
            })}
            {(depsQuery.data?.blocked_by ?? []).length === 0 && (
              <li className="text-neutral-500">{t("assignments.detail.notBlocked")}</li>
            )}
          </ul>
          {(depsQuery.data?.blocks ?? []).length > 0 && (
            <p className="mb-3 text-xs text-neutral-500">
              {t("assignments.detail.blocksLater", { count: (depsQuery.data?.blocks ?? []).length })}
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="assignment-depends-on" className="block min-w-[220px] flex-1 text-sm">
              <span className="mb-1 block text-neutral-600">{t("assignments.detail.dependsOn")}</span>
              <select
                id="assignment-depends-on"
                className="form-input w-full"
                value={depId}
                onChange={(e) => setDepId(e.target.value)}
              >
                <option value="">{t("assignments.detail.selectAssignment")}</option>
                {(peersQuery.data ?? [])
                  .filter((a) => a.id !== assignment.id)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} ({a.reference_number})
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={!depId || addDep.isPending}
              onClick={() => addDep.mutate()}
            >
              {t("assignments.detail.addDependency")}
            </button>
          </div>
        </div>

        {/* Objective & Output */}
        {(assignment.objective || assignment.expected_output) && (
          <div className="card p-5">
            <SectionIcon icon="flag" color="bg-primary/10 text-primary" label={t("assignments.detail.objectiveOutput")} />
            {assignment.objective && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">{t("assignments.create.objective")}</p>
                <p className="text-sm text-neutral-700">{assignment.objective}</p>
              </div>
            )}
            {assignment.expected_output && (
              <div>
                <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">{t("assignments.create.expectedOutput")}</p>
                <p className="text-sm text-neutral-700">{assignment.expected_output}</p>
              </div>
            )}
          </div>
        )}

        {/* Blocker */}
        {assignment.blocker_type && (
          <div className="card p-5 border-red-200 bg-red-50">
            <SectionIcon icon="block" color="bg-red-100 text-red-600" label={t("assignments.detail.activeBlocker")} />
            <p className="text-sm font-semibold text-red-700 mb-1">
              {BLOCKER_KEYS[assignment.blocker_type] ? t(BLOCKER_KEYS[assignment.blocker_type]) : assignment.blocker_type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
            </p>
            {assignment.blocker_details && (
              <p className="text-sm text-red-600">{assignment.blocker_details}</p>
            )}
          </div>
        )}

        {/* Acceptance info */}
        {assignment.acceptance_decision && (
          <div className="card p-5">
            <SectionIcon icon="task_alt" color="bg-green-50 text-green-600" label={t("assignments.detail.acceptanceResponse")} />
            <div className="space-y-2 text-sm">
              <InfoRow icon="check" label={t("assignments.detail.decision")} value={enumLabel(t, DECISION_KEYS, assignment.acceptance_decision)} />
              {assignment.acceptance_notes && (
                <InfoRow icon="notes" label={t("assignments.detail.notes")} value={assignment.acceptance_notes} />
              )}
              {assignment.proposed_deadline && (
                <InfoRow icon="event" label={t("assignments.detail.proposedDeadline")} value={formatDateShort(assignment.proposed_deadline)} />
              )}
            </div>
          </div>
        )}

        {/* Closure */}
        {assignment.status === "closed" && (
          <div className="card p-5">
            <SectionIcon icon="lock" color="bg-neutral-100 text-neutral-600" label={t("assignments.detail.closure")} />
            <div className="space-y-2 text-sm">
              {assignment.closed_at && (
                <InfoRow icon="calendar_today" label={t("assignments.detail.closedOn")} value={formatDateShort(assignment.closed_at)} />
              )}
              {assignment.completion_rating && (
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[14px] text-neutral-400">star</span>
                  <span className="text-neutral-500 w-20">{t("assignments.detail.rating")}</span>
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
                <InfoRow icon="notes" label={t("assignments.detail.notes")} value={assignment.closure_notes} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Checklist */}
      {(assignment.checklist_items?.length ?? 0) > 0 && (
        <div className="card p-5">
          <SectionIcon icon="checklist" color="bg-teal-50 text-teal-600" label={t("assignments.detail.checklist")} />
          <ul className="space-y-2">
            {assignment.checklist_items!.map((item) => (
              <li key={item.id} className="flex items-center gap-2 text-sm">
                <button
                  type="button"
                  className="flex h-5 w-5 items-center justify-center rounded border border-neutral-300"
                  onClick={() => toggleChecklistMutation.mutate({ itemId: item.id, completed: !item.completed })}
                >
                  {item.completed && <span className="material-symbols-outlined text-[14px] text-green-600">check</span>}
                </button>
                <span className={cn(item.completed && "line-through text-neutral-400")}>{item.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Update Timeline */}
      <div className="card p-5">
        <SectionIcon icon="history" color="bg-neutral-100 text-neutral-600" label={t("assignments.detail.timeline")} />
        {(assignment.updates?.length ?? 0) > 0 ? (
          <div className="space-y-0">
            {assignment.updates!.map((u) => <UpdateItem key={u.id} u={u} />)}
          </div>
        ) : (
          <p className="text-sm text-neutral-400 text-center py-4">{t("assignments.detail.noUpdates")}</p>
        )}
      </div>

      {/* ── Modals ── */}

      {/* Post Update Modal */}
      {showUpdateModal && (
        <Modal title={t("assignments.detail.postUpdate")} onClose={() => setShowUpdateModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-update-type" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.updateType")}</label>
              <select
                id="assignment-update-type"
                value={updateForm.type}
                onChange={(e) => setUpdateForm((f) => ({ ...f, type: e.target.value }))}
                className="form-input"
              >
                <option value="update">{t("assignments.detail.updateTypes.update")}</option>
                <option value="comment">{t("assignments.detail.updateTypes.comment")}</option>
                <option value="feedback">{t("assignments.detail.updateTypes.feedback")}</option>
                <option value="escalation">{t("assignments.detail.updateTypes.escalation")}</option>
                <option value="closure_request">{t("assignments.detail.updateTypes.closure_request")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="assignment-update-progress" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.progressPct")}</label>
              <input
                id="assignment-update-progress"
                type="number"
                min={0}
                max={100}
                value={updateForm.progress_percent}
                onChange={(e) => setUpdateForm((f) => ({ ...f, progress_percent: e.target.value }))}
                placeholder={t("assignments.detail.currentProgress", { percent: assignment.progress_percent })}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="assignment-update-notes" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.notes")} <span className="text-red-500">*</span></label>
              <textarea
                id="assignment-update-notes"
                rows={4}
                value={updateForm.notes}
                onChange={(e) => setUpdateForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("assignments.detail.notesPlaceholder")}
                className="form-input"
              />
            </div>
            <div>
              <label htmlFor="assignment-update-blocker" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.blockerIfAny")}</label>
              <select
                id="assignment-update-blocker"
                value={updateForm.blocker_type}
                onChange={(e) => setUpdateForm((f) => ({ ...f, blocker_type: e.target.value }))}
                className="form-input"
              >
                <option value="">{t("assignments.detail.noBlocker")}</option>
                <option value="awaiting_approval">{t("assignments.blocker.awaiting_approval")}</option>
                <option value="awaiting_funds">{t("assignments.blocker.awaiting_funds")}</option>
                <option value="awaiting_information">{t("assignments.blocker.awaiting_information")}</option>
                <option value="external_dependency">{t("assignments.blocker.external_dependency")}</option>
              </select>
            </div>
            {updateForm.blocker_type && (
              <div>
                <label htmlFor="assignment-update-blocker-details" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.blockerDetails")}</label>
                <textarea
                  id="assignment-update-blocker-details"
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
                {updateMutation.isPending ? t("assignments.detail.posting") : t("assignments.detail.postUpdate")}
              </button>
              <button onClick={() => setShowUpdateModal(false)} className="btn-secondary">{t("common.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Accept Modal */}
      {showAcceptModal && (
        <Modal title={t("assignments.detail.respond")} onClose={() => setShowAcceptModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-accept-decision" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.decision")}</label>
              <select
                id="assignment-accept-decision"
                value={acceptForm.decision}
                onChange={(e) => setAcceptForm((f) => ({ ...f, decision: e.target.value }))}
                className="form-input"
              >
                <option value="accepted">{t("assignments.detail.accept")}</option>
                <option value="clarification_requested">{t("assignments.detail.requestClarification")}</option>
                <option value="deadline_proposed">{t("assignments.detail.proposeDeadline")}</option>
                <option value="rejected">{t("assignments.detail.decline")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="assignment-accept-notes" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.notes")}</label>
              <textarea
                id="assignment-accept-notes"
                rows={3}
                value={acceptForm.notes}
                onChange={(e) => setAcceptForm((f) => ({ ...f, notes: e.target.value }))}
                className="form-input"
              />
            </div>
            {acceptForm.decision === "deadline_proposed" && (
              <div>
                <label htmlFor="assignment-accept-deadline" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.proposedDeadline")}</label>
                <input
                  id="assignment-accept-deadline"
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
                {acceptMutation.isPending ? t("assignments.detail.submitting") : t("assignments.detail.submitResponse")}
              </button>
              <button onClick={() => setShowAcceptModal(false)} className="btn-secondary">{t("common.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Close Modal */}
      {showCloseModal && (
        <Modal title={t("assignments.detail.closeAssignment")} onClose={() => setShowCloseModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-close-notes" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.closureNotes")}</label>
              <textarea
                id="assignment-close-notes"
                rows={3}
                value={closeForm.notes}
                onChange={(e) => setCloseForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder={t("assignments.detail.closurePlaceholder")}
                className="form-input"
              />
            </div>
            <div>
              <p id="assignment-close-rating" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.performanceRating")}</p>
              <div className="flex gap-2" role="radiogroup" aria-labelledby="assignment-close-rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={closeForm.rating === String(n)}
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
                {closeMutation.isPending ? t("assignments.detail.closing") : t("assignments.detail.closeAssignment")}
              </button>
              <button onClick={() => setShowCloseModal(false)} className="btn-secondary">{t("common.cancel")}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <Modal title={t("assignments.detail.cancelAssignment")} onClose={() => setShowCancelModal(false)}>
          <div className="space-y-4">
            <p className="text-sm text-neutral-600">{t("assignments.detail.cancelConfirm")}</p>
            <div>
              <label htmlFor="assignment-cancel-reason" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.reasonOptional")}</label>
              <textarea
                id="assignment-cancel-reason"
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
                {cancelMutation.isPending ? t("assignments.detail.cancelling") : t("assignments.detail.confirmCancel")}
              </button>
              <button onClick={() => setShowCancelModal(false)} className="btn-secondary">{t("assignments.detail.keep")}</button>
            </div>
          </div>
        </Modal>
      )}

      {showBlockModal && (
        <Modal title={t("assignments.detail.markBlocked")} onClose={() => setShowBlockModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-block-type" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.blockerType")}</label>
              <select id="assignment-block-type" className="form-input" value={blockForm.blocker_type} onChange={(e) => setBlockForm((f) => ({ ...f, blocker_type: e.target.value }))}>
                <option value="awaiting_approval">{t("assignments.blockerOption.awaiting_approval")}</option>
                <option value="awaiting_funds">{t("assignments.blockerOption.awaiting_funds")}</option>
                <option value="awaiting_information">{t("assignments.blockerOption.awaiting_information")}</option>
                <option value="external_dependency">{t("assignments.blockerOption.external_dependency")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="assignment-block-owner" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.blockerOwner")}</label>
              <select id="assignment-block-owner" className="form-input" value={blockForm.blocker_owner_id} onChange={(e) => setBlockForm((f) => ({ ...f, blocker_owner_id: e.target.value }))}>
                <option value="">{t("assignments.detail.select")}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="assignment-block-details" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.details")}</label>
              <textarea id="assignment-block-details" className="form-input" rows={3} value={blockForm.blocker_details} onChange={(e) => setBlockForm((f) => ({ ...f, blocker_details: e.target.value }))} />
            </div>
            <button
              className="btn-primary disabled:opacity-60"
              disabled={blockMutation.isPending || !blockForm.blocker_owner_id}
              onClick={() => blockMutation.mutate()}
            >
              {blockMutation.isPending ? t("assignments.recurring.saving") : t("assignments.detail.markBlocked")}
            </button>
          </div>
        </Modal>
      )}

      {showVerifyModal && (
        <Modal title={t("assignments.detail.verifyCompletion")} onClose={() => setShowVerifyModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-verify-decision" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.decision")}</label>
              <select id="assignment-verify-decision" className="form-input" value={verifyForm.decision} onChange={(e) => setVerifyForm((f) => ({ ...f, decision: e.target.value }))}>
                <option value="accepted">{t("assignments.status.accepted")}</option>
                <option value="accepted_with_follow_up">{t("assignments.detail.acceptedFollowUp")}</option>
                <option value="returned">{t("assignments.status.returned")}</option>
                <option value="request_evidence">{t("assignments.detail.requestEvidence")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="assignment-verify-comments" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.comments")}</label>
              <textarea id="assignment-verify-comments" className="form-input" rows={3} value={verifyForm.comments} onChange={(e) => setVerifyForm((f) => ({ ...f, comments: e.target.value }))} />
            </div>
            <button className="btn-primary disabled:opacity-60" disabled={verifyMutation.isPending} onClick={() => verifyMutation.mutate()}>
              {verifyMutation.isPending ? t("assignments.recurring.saving") : t("assignments.detail.submitVerification")}
            </button>
          </div>
        </Modal>
      )}

      {showReassignModal && (
        <Modal title={t("assignments.detail.reassign")} onClose={() => setShowReassignModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-reassign-user" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.newAssignee")}</label>
              <select id="assignment-reassign-user" className="form-input" value={reassignForm.assigned_to} onChange={(e) => setReassignForm((f) => ({ ...f, assigned_to: e.target.value }))}>
                <option value="">{t("assignments.detail.select")}</option>
                {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="assignment-reassign-reason" className="block text-sm font-medium text-neutral-700 mb-1">{t("common.reason")}</label>
              <textarea id="assignment-reassign-reason" className="form-input" rows={3} value={reassignForm.reason} onChange={(e) => setReassignForm((f) => ({ ...f, reason: e.target.value }))} />
            </div>
            <button
              className="btn-primary disabled:opacity-60"
              disabled={reassignMutation.isPending || !reassignForm.assigned_to || !reassignForm.reason.trim()}
              onClick={() => reassignMutation.mutate()}
            >
              {reassignMutation.isPending ? t("assignments.recurring.saving") : t("assignments.detail.reassign")}
            </button>
          </div>
        </Modal>
      )}

      {showDueDateModal && (
        <Modal title={t("assignments.detail.changeDueDate")} onClose={() => setShowDueDateModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-due-date" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.detail.newDueDate")}</label>
              <input
                id="assignment-due-date"
                type="date"
                className="form-input"
                value={dueDateForm.due_date}
                onChange={(e) => setDueDateForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="assignment-due-reason" className="block text-sm font-medium text-neutral-700 mb-1">{t("common.reason")}</label>
              <textarea
                id="assignment-due-reason"
                className="form-input"
                rows={3}
                value={dueDateForm.reason}
                onChange={(e) => setDueDateForm((f) => ({ ...f, reason: e.target.value }))}
              />
            </div>
            <button
              className="btn-primary disabled:opacity-60"
              disabled={changeDueDateMutation.isPending || !dueDateForm.due_date || !dueDateForm.reason.trim()}
              onClick={() => changeDueDateMutation.mutate()}
            >
              {changeDueDateMutation.isPending ? t("assignments.recurring.saving") : t("assignments.detail.updateDueDate")}
            </button>
          </div>
        </Modal>
      )}

      {showChecklistModal && (
        <Modal title={t("assignments.detail.addChecklistItem")} onClose={() => setShowChecklistModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="assignment-checklist-title" className="block text-sm font-medium text-neutral-700 mb-1">{t("assignments.create.titleLabel")}</label>
              <input id="assignment-checklist-title" className="form-input" value={checklistTitle} onChange={(e) => setChecklistTitle(e.target.value)} />
            </div>
            <button
              className="btn-primary disabled:opacity-60"
              disabled={checklistMutation.isPending || !checklistTitle.trim()}
              onClick={() => checklistMutation.mutate()}
            >
              {checklistMutation.isPending ? t("assignments.detail.adding") : t("assignments.detail.addItem")}
            </button>
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
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-neutral-900">{title}</h3>
          <button onClick={onClose} aria-label={t("assignments.detail.closeModal", { title })} className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
