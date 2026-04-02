"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { riskApi, type Risk, type RiskAction, type RiskHistory } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";
import axios from "axios";

// ── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "text-neutral-600 bg-neutral-100 border-neutral-200", icon: "edit_note"       },
  submitted:  { label: "Submitted",  cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"         },
  reviewed:   { label: "Reviewed",   cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "rate_review"     },
  approved:   { label: "Approved",   cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"    },
  monitoring: { label: "Monitoring", cls: "text-teal-700 bg-teal-50 border-teal-200",           icon: "monitor_heart"   },
  escalated:  { label: "Escalated",  cls: "text-red-700 bg-red-50 border-red-200",              icon: "warning"         },
  closed:     { label: "Closed",     cls: "text-neutral-600 bg-neutral-100 border-neutral-200", icon: "lock"            },
  archived:   { label: "Archived",   cls: "text-neutral-500 bg-neutral-50 border-neutral-200",  icon: "archive"         },
};

const LEVEL_CONFIG: Record<string, { label: string; cls: string; bar: string }> = {
  low:      { label: "Low",      cls: "text-green-700 bg-green-100 border-green-300",      bar: "bg-green-500"  },
  medium:   { label: "Medium",   cls: "text-yellow-700 bg-yellow-100 border-yellow-300",   bar: "bg-yellow-500" },
  high:     { label: "High",     cls: "text-orange-700 bg-orange-100 border-orange-300",   bar: "bg-orange-500" },
  critical: { label: "Critical", cls: "text-red-700 bg-red-100 border-red-300",            bar: "bg-red-600"    },
};

const CHANGE_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  created:          { icon: "add_circle",     color: "text-primary"   },
  updated:          { icon: "edit",           color: "text-neutral-500"},
  submitted:        { icon: "send",           color: "text-amber-600" },
  reviewed:         { icon: "rate_review",    color: "text-blue-600"  },
  approved:         { icon: "check_circle",   color: "text-green-600" },
  escalated:        { icon: "warning",        color: "text-red-600"   },
  closed:           { icon: "lock",           color: "text-neutral-600"},
  archived:         { icon: "archive",        color: "text-neutral-400"},
  reopened:         { icon: "refresh",        color: "text-teal-600"  },
  action_added:     { icon: "add_task",       color: "text-primary"   },
  action_completed: { icon: "task_alt",       color: "text-green-600" },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStoredUser(): { roles?: string[]; id?: number } | null {
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}

function hasRole(user: { roles?: string[] } | null, ...roles: string[]): boolean {
  return (user?.roles ?? []).some((r) => roles.includes(r));
}

function ScoreMeter({ score, label }: { score: number; label: string }) {
  const pct = Math.round((score / 25) * 100);
  const color = score >= 16 ? "bg-red-500" : score >= 11 ? "bg-orange-500" : score >= 6 ? "bg-yellow-500" : "bg-green-500";
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-neutral-500">{label}</span>
        <span className="text-sm font-bold text-neutral-800">{score}</span>
      </div>
      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
      <span className={`material-symbols-outlined text-[16px] ${color}`}>{icon}</span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function RiskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = use(params);
  const { fmt } = useFormatDate();

  const [risk, setRisk]       = useState<Risk | null>(null);
  const [actions, setActions] = useState<RiskAction[]>([]);
  const [history, setHistory] = useState<RiskHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ roles?: string[]; id?: number } | null>(null);

  // Action form
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState({ description: "", treatment_type: "mitigate", due_date: "" });
  const [savingAction, setSavingAction] = useState(false);

  // Workflow modals
  const [modal, setModal]         = useState<string | null>(null);
  const [modalData, setModalData] = useState<Record<string, string>>({});
  const [working, setWorking]     = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  useEffect(() => { setCurrentUser(getStoredUser()); }, []);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) { setError("Invalid risk ID"); setLoading(false); return; }
    Promise.all([
      riskApi.get(id).then((r) => setRisk(r.data.data)),
      riskApi.listActions(id).then((r) => setActions(r.data.data ?? [])),
      riskApi.getLogs(id).then((r) => setHistory(r.data.data ?? [])),
    ])
      .catch(() => setError("Failed to load risk."))
      .finally(() => setLoading(false));
  }, [paramId]);

  async function doWorkflowAction() {
    if (!risk) return;
    setWorking(true);
    setModalError(null);
    try {
      let res;
      if (modal === "submit")      res = await riskApi.submit(risk.id);
      else if (modal === "review") res = await riskApi.startReview(risk.id);
      else if (modal === "approve")res = await riskApi.approve(risk.id, { review_notes: modalData.notes });
      else if (modal === "escalate") res = await riskApi.escalate(risk.id, { escalation_level: modalData.level, notes: modalData.notes });
      else if (modal === "close")  res = await riskApi.close(risk.id, { closure_evidence: modalData.evidence });
      else if (modal === "archive")res = await riskApi.archive(risk.id);
      else if (modal === "reopen") res = await riskApi.reopen(risk.id);
      if (res) setRisk(res.data.data);
      setModal(null);
      setModalData({});
      // Refresh history
      riskApi.getLogs(risk.id).then((r) => setHistory(r.data.data ?? []));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? "Action failed." : "Action failed.";
      setModalError(msg);
    } finally {
      setWorking(false);
    }
  }

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!risk) return;
    setSavingAction(true);
    try {
      const res = await riskApi.addAction(risk.id, actionForm as any);
      setActions((prev) => [...prev, res.data.data]);
      setActionForm({ description: "", treatment_type: "mitigate", due_date: "" });
      setShowActionForm(false);
    } catch { /* silent */ }
    finally { setSavingAction(false); }
  }

  async function completeAction(action: RiskAction) {
    if (!risk) return;
    try {
      const res = await riskApi.completeAction(risk.id, action.id);
      setActions((prev) => prev.map((a) => a.id === action.id ? res.data.data : a));
    } catch { /* silent */ }
  }

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded" />
        <div className="h-10 w-96 bg-neutral-200 rounded" />
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-32 bg-neutral-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (error || !risk) {
    return (
      <div className="max-w-4xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{error ?? "Risk not found."}</div>
        <Link href="/risk" className="btn-secondary mt-4 inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.draft;
  const levelCfg  = LEVEL_CONFIG[risk.risk_level] ?? LEVEL_CONFIG.low;

  const WORKFLOW_STEPS = [
    { key: "draft",      label: "Draft"      },
    { key: "submitted",  label: "Submitted"  },
    { key: "reviewed",   label: "Reviewed"   },
    { key: "approved",   label: "Approved"   },
    { key: "monitoring", label: "Monitoring" },
    { key: "escalated",  label: "Escalated"  },
    { key: "closed",     label: "Closed"     },
    { key: "archived",   label: "Archived"   },
  ];
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === risk.status);

  const EFFECTIVENESS_TILES = [
    { key: "none",     label: "None",     active: "bg-red-100 border-red-400 text-red-700"     },
    { key: "partial",  label: "Partial",  active: "bg-yellow-100 border-yellow-400 text-yellow-700" },
    { key: "adequate", label: "Adequate", active: "bg-blue-100 border-blue-400 text-blue-700"  },
    { key: "strong",   label: "Strong",   active: "bg-green-100 border-green-400 text-green-700" },
  ];

  // Role-based action availability
  const canReview    = hasRole(currentUser, "HOD", "Director", "Governance Officer", "Internal Auditor", "System Admin", "super-admin");
  const canApprove   = hasRole(currentUser, "Director", "Secretary General", "System Admin", "super-admin");
  const canEscalate  = hasRole(currentUser, "HOD", "Director", "Governance Officer", "Secretary General", "System Admin", "super-admin");
  const canClose     = hasRole(currentUser, "Director", "Secretary General", "System Admin", "super-admin");
  const canArchive   = hasRole(currentUser, "Secretary General", "System Admin", "super-admin");
  const canReopen    = hasRole(currentUser, "Director", "Governance Officer", "Secretary General", "System Admin", "super-admin");
  const isOwner      = currentUser?.id === risk.submitted_by || currentUser?.id === risk.risk_owner_id;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-xs text-neutral-600">{risk.risk_code}</span>
      </div>

      {/* Status stepper */}
      <div className="card px-5 py-4 overflow-x-auto">
        <div className="flex items-center min-w-max gap-0">
          {WORKFLOW_STEPS.map((step, idx) => {
            const isPast    = idx < currentStepIdx;
            const isCurrent = idx === currentStepIdx;
            const isFuture  = idx > currentStepIdx;
            return (
              <div key={step.key} className="flex items-center">
                <div className="flex flex-col items-center gap-1">
                  <div className={`h-7 w-7 rounded-full flex items-center justify-center border-2 transition-all ${isCurrent ? "bg-primary border-primary text-white" : isPast ? "bg-primary/20 border-primary/40 text-primary" : "bg-neutral-100 border-neutral-200 text-neutral-400"}`}>
                    {isPast
                      ? <span className="material-symbols-outlined text-[13px]">check</span>
                      : <span className="text-[10px] font-bold">{idx + 1}</span>}
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${isCurrent ? "text-primary" : isFuture ? "text-neutral-300" : "text-neutral-500"}`}>
                    {step.label}
                  </span>
                </div>
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className={`h-0.5 w-8 mx-1 mb-4 rounded ${isPast ? "bg-primary/40" : "bg-neutral-200"}`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <h1 className="text-xl font-bold text-neutral-900 leading-snug">{risk.title}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400">{risk.risk_code}</span>
              <span className="text-neutral-300">·</span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${levelCfg.cls}`}>
                {risk.risk_level.toUpperCase()} — Score {risk.inherent_score}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.cls}`}>
                <span className="material-symbols-outlined text-[11px]">{statusCfg.icon}</span>
                {statusCfg.label}
              </span>
              {risk.status === "escalated" && risk.escalation_level !== "none" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border text-orange-700 bg-orange-50 border-orange-200">
                  <span className="material-symbols-outlined text-[11px]">escalator_warning</span>
                  {risk.escalation_level.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                </span>
              )}
            </div>
          </div>

          {/* Workflow action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {risk.status === "draft" && isOwner && (
              <button onClick={() => setModal("submit")} className="btn-primary flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]">send</span> Submit
              </button>
            )}
            {risk.status === "submitted" && canReview && (
              <button onClick={() => setModal("review")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">rate_review</span> Start Review
              </button>
            )}
            {risk.status === "reviewed" && canApprove && (
              <button onClick={() => setModal("approve")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">check_circle</span> Approve
              </button>
            )}
            {["submitted","reviewed","approved","monitoring"].includes(risk.status) && canEscalate && (
              <button onClick={() => setModal("escalate")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">warning</span> Escalate
              </button>
            )}
            {["approved","monitoring","escalated"].includes(risk.status) && canClose && (
              <button onClick={() => setModal("close")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 hover:bg-neutral-200 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">lock</span> Close
              </button>
            )}
            {risk.status === "closed" && canArchive && (
              <button onClick={() => setModal("archive")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">archive</span> Archive
              </button>
            )}
            {["closed","archived"].includes(risk.status) && canReopen && (
              <button onClick={() => setModal("reopen")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">refresh</span> Reopen
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

        {/* Left column — details */}
        <div className="lg:col-span-2 space-y-5">

          {/* Description */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-3">
              <SectionIcon icon="description" color="text-primary" bg="bg-primary/10" />
              <h2 className="text-sm font-semibold text-neutral-800">Description</h2>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{risk.description}</p>
          </div>

          {/* Risk info */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="info" color="text-indigo-600" bg="bg-indigo-50" />
              <h2 className="text-sm font-semibold text-neutral-800">Risk Details</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: "Category",          value: risk.category.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
                { label: "Risk Owner",         value: risk.riskOwner?.name ?? "—"          },
                { label: "Action Owner",       value: risk.actionOwner?.name ?? "—"        },
                { label: "Submitted by",       value: risk.submitter?.name ?? "—"          },
                { label: "Submitted at",       value: risk.submitted_at ? fmt(risk.submitted_at) : "—" },
                { label: "Review Frequency",   value: risk.review_frequency?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "—" },
                { label: "Next Review",        value: risk.next_review_date ? fmt(risk.next_review_date) : "—" },
                { label: "Control Effectiveness", value: risk.control_effectiveness.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-neutral-400 font-medium">{label}</p>
                  <p className="text-neutral-800 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {risk.review_notes && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 font-medium mb-1">Review Notes</p>
                <p className="text-sm text-neutral-700">{risk.review_notes}</p>
              </div>
            )}
            {risk.closure_evidence && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 font-medium mb-1">Closure Evidence</p>
                <p className="text-sm text-neutral-700">{risk.closure_evidence}</p>
              </div>
            )}
          </div>

          {/* Mitigation Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon="task_alt" color="text-teal-600" bg="bg-teal-50" />
                <h2 className="text-sm font-semibold text-neutral-800">Mitigation Actions</h2>
                {actions.length > 0 && (
                  <span className="h-5 min-w-5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-semibold flex items-center justify-center px-1.5">{actions.length}</span>
                )}
              </div>
              {!showActionForm && (
                <button onClick={() => setShowActionForm(true)} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add</span> Add action
                </button>
              )}
            </div>

            {showActionForm && (
              <form onSubmit={handleAddAction} className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 mb-4 space-y-3">
                <h3 className="text-xs font-semibold text-neutral-700">New Mitigation Action</h3>
                <div>
                  <label className="block text-xs text-neutral-500 mb-1">Description <span className="text-red-500">*</span></label>
                  <textarea
                    className="form-input w-full h-20 resize-none text-sm"
                    placeholder="Describe the action to be taken…"
                    value={actionForm.description}
                    onChange={(e) => setActionForm((p) => ({ ...p, description: e.target.value }))}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Treatment Type</label>
                    <select
                      className="form-input w-full text-sm"
                      value={actionForm.treatment_type}
                      onChange={(e) => setActionForm((p) => ({ ...p, treatment_type: e.target.value }))}
                    >
                      <option value="mitigate">Mitigate</option>
                      <option value="accept">Accept</option>
                      <option value="transfer">Transfer</option>
                      <option value="avoid">Avoid</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500 mb-1">Due Date</label>
                    <input
                      type="date"
                      className="form-input w-full text-sm"
                      value={actionForm.due_date}
                      onChange={(e) => setActionForm((p) => ({ ...p, due_date: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowActionForm(false)} className="btn-secondary text-xs py-1.5">Cancel</button>
                  <button type="submit" disabled={savingAction} className="btn-primary text-xs py-1.5 flex items-center gap-1">
                    {savingAction && <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    Add Action
                  </button>
                </div>
              </form>
            )}

            {actions.length === 0 ? (
              <p className="text-sm text-neutral-400 py-3">No mitigation actions recorded.</p>
            ) : (
              <div className="space-y-2">
                {actions.map((action) => {
                  const isComplete = action.status === "completed";
                  const isOverdue  = action.due_date && new Date(action.due_date) < new Date() && !isComplete;
                  return (
                    <div key={action.id} className={`rounded-lg border p-3 ${isComplete ? "bg-green-50 border-green-200" : isOverdue ? "bg-red-50 border-red-200" : "border-neutral-200"}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm ${isComplete ? "line-through text-neutral-400" : "text-neutral-800"}`}>{action.description}</p>
                          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                            <span className="text-xs text-neutral-400 capitalize">{action.treatment_type}</span>
                            {action.due_date && (
                              <span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-neutral-400"}`}>
                                Due {action.due_date}
                              </span>
                            )}
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isComplete ? "text-green-700 bg-green-100" : isOverdue ? "text-red-700 bg-red-100" : "text-neutral-600 bg-neutral-100"}`}>
                              {action.status.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase())}
                            </span>
                          </div>
                          {/* Progress bar */}
                          {!isComplete && (
                            <div className="mt-2 h-1.5 rounded-full bg-neutral-200 overflow-hidden w-full max-w-[180px]">
                              <div className="h-full bg-primary rounded-full" style={{ width: `${action.progress}%` }} />
                            </div>
                          )}
                        </div>
                        {!isComplete && (
                          <button
                            onClick={() => completeAction(action)}
                            className="text-xs text-green-700 hover:text-green-800 flex items-center gap-0.5 flex-shrink-0"
                            title="Mark complete"
                          >
                            <span className="material-symbols-outlined text-[16px]">check_circle</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right column — scoring + history */}
        <div className="space-y-5">
          {/* Score card */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="analytics" color="text-orange-600" bg="bg-orange-50" />
              <h2 className="text-sm font-semibold text-neutral-800">Risk Scoring</h2>
            </div>
            <div className="space-y-3">
              <ScoreMeter score={risk.inherent_score} label="Inherent Score" />
              {risk.residual_score != null && (
                <ScoreMeter score={risk.residual_score} label="Residual Score" />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-center">
                <p className="text-lg font-bold text-neutral-900">{risk.likelihood}</p>
                <p className="text-[10px] text-neutral-400">Likelihood</p>
              </div>
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-center">
                <p className="text-lg font-bold text-neutral-900">{risk.impact}</p>
                <p className="text-[10px] text-neutral-400">Impact</p>
              </div>
            </div>
            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-center text-sm font-bold ${levelCfg.cls}`}>
              {levelCfg.label} Risk
            </div>
            {/* Control effectiveness read-only tiles */}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 font-medium mb-2">Control Effectiveness</p>
              <div className="grid grid-cols-2 gap-1.5">
                {EFFECTIVENESS_TILES.map((tile) => {
                  const isActive = risk.control_effectiveness === tile.key;
                  return (
                    <div
                      key={tile.key}
                      className={`rounded-lg border px-2 py-1.5 text-center text-xs font-semibold transition-all ${isActive ? tile.active : "bg-neutral-50 border-neutral-200 text-neutral-300"}`}
                    >
                      {tile.label}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Review history */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="history" color="text-purple-600" bg="bg-purple-50" />
              <h2 className="text-sm font-semibold text-neutral-800">History</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-neutral-400">No history yet.</p>
            ) : (
              <div className="relative">
                <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
                <div className="space-y-4">
                  {history.map((h) => {
                    const cfg = CHANGE_TYPE_ICONS[h.change_type] ?? { icon: "info", color: "text-neutral-500" };
                    return (
                      <div key={h.id} className="flex gap-3 relative">
                        <div className={`h-7 w-7 rounded-full bg-white border-2 border-neutral-200 flex items-center justify-center flex-shrink-0 z-10`}>
                          <span className={`material-symbols-outlined text-[13px] ${cfg.color}`}>{cfg.icon}</span>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-xs text-neutral-700 font-medium capitalize">
                            {h.change_type.replace(/_/g, " ")}
                            {h.from_status && h.to_status && (
                              <span className="text-neutral-400 font-normal"> · {h.from_status} → {h.to_status}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {h.actor?.name ?? "System"} · {fmt(h.created_at)}
                          </p>
                          {h.notes && <p className="text-xs text-neutral-500 mt-1 italic">"{h.notes}"</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <Link href="/risk" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Risk Register
      </Link>

      {/* ── Workflow Modal ── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => { setModal(null); setModalError(null); }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-primary">
                  {modal === "submit" ? "send" : modal === "review" ? "rate_review" : modal === "approve" ? "check_circle" : modal === "escalate" ? "warning" : modal === "close" ? "lock" : modal === "archive" ? "archive" : "refresh"}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  {modal === "submit" ? "Submit Risk" : modal === "review" ? "Start Review" : modal === "approve" ? "Approve Risk" : modal === "escalate" ? "Escalate Risk" : modal === "close" ? "Close Risk" : modal === "archive" ? "Archive Risk" : "Reopen Risk"}
                </h2>
                <p className="text-xs text-neutral-500">{risk.risk_code}</p>
              </div>
            </div>

            {modalError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{modalError}</div>
            )}

            {modal === "escalate" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Escalation Level <span className="text-red-500">*</span></label>
                  <select className="form-input w-full" value={modalData.level ?? ""} onChange={(e) => setModalData((p) => ({ ...p, level: e.target.value }))}>
                    <option value="">Select…</option>
                    <option value="departmental">Departmental</option>
                    <option value="directorate">Directorate</option>
                    <option value="sg">Secretary General</option>
                    <option value="committee">Committee</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Notes</label>
                  <textarea className="form-input w-full h-20 resize-none" value={modalData.notes ?? ""} onChange={(e) => setModalData((p) => ({ ...p, notes: e.target.value }))} placeholder="Reason for escalation…" />
                </div>
              </>
            )}

            {modal === "approve" && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Review Notes</label>
                <textarea className="form-input w-full h-20 resize-none" value={modalData.notes ?? ""} onChange={(e) => setModalData((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes for the risk owner…" />
              </div>
            )}

            {modal === "close" && (
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Closure Evidence <span className="text-red-500">*</span></label>
                <textarea className="form-input w-full h-24 resize-none" value={modalData.evidence ?? ""} onChange={(e) => setModalData((p) => ({ ...p, evidence: e.target.value }))} placeholder="Document what evidence confirms this risk is closed…" />
              </div>
            )}

            {(modal === "submit" || modal === "review" || modal === "archive" || modal === "reopen") && (
              <p className="text-sm text-neutral-600">
                {modal === "submit"  && "Submit this risk for departmental review. You will not be able to edit it once submitted."}
                {modal === "review"  && "Start the formal review process for this risk."}
                {modal === "archive" && "Archive this closed risk. It will be removed from the active register."}
                {modal === "reopen"  && "Reopen this risk and move it back to 'Submitted' status for reassessment."}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button className="btn-secondary flex-1" onClick={() => { setModal(null); setModalError(null); }} disabled={working}>Cancel</button>
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
                onClick={doWorkflowAction}
                disabled={working || (modal === "escalate" && !modalData.level) || (modal === "close" && !modalData.evidence?.trim())}
              >
                {working ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
