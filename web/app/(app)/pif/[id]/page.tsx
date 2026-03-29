"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFormatDate } from "@/lib/useFormatDate";
import {
  programmeApi,
  QUOTE_ATTACHMENT_TYPES,
  type Programme,
  type ProgrammeActivity,
  type ProgrammeMilestone,
  type ProgrammeDeliverable,
  type ProgrammeBudgetLine,
  type ProgrammeProcurementItem,
  type ProgrammeAttachment,
  type ProgrammeAttachmentType,
} from "@/lib/api";
import { useConfirm } from "@/components/ui/ConfirmDialog";

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  submitted: "badge-warning",
  approved: "badge-success",
  active: "badge-primary",
  on_hold: "badge-warning",
  completed: "badge-success",
  financially_closed: "badge-muted",
  archived: "badge-muted",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Draft", submitted: "Submitted", approved: "Approved", active: "Active",
  on_hold: "On Hold", completed: "Completed", financially_closed: "Fin. Closed", archived: "Archived",
};
const ACT_BADGE: Record<string, string> = {
  draft: "badge-muted", approved: "badge-success", in_progress: "badge-primary",
  completed: "badge-success", postponed: "badge-warning", cancelled: "badge-danger",
};
const MS_BADGE: Record<string, string> = {
  pending: "badge-warning", achieved: "badge-success", missed: "badge-danger",
};
const DEL_BADGE: Record<string, string> = {
  pending: "badge-warning", submitted: "badge-primary", accepted: "badge-success",
};
const PROC_BADGE: Record<string, string> = {
  pending: "badge-warning", ordered: "badge-primary", delivered: "badge-success", cancelled: "badge-danger",
};
const METHOD_LABEL: Record<string, string> = {
  direct_purchase: "Direct Purchase", three_quotations: "3 Quotations", tender: "Tender",
};
const ATTACHMENT_TYPE_LABEL: Record<ProgrammeAttachmentType, string> = {
  concept_note: "Concept Note",
  memo: "Memo",
  hotel_quote: "Hotel Quote",
  transport_quote: "Transport Quote",
  other: "Other",
};

type DetailTab = "overview" | "activities" | "milestones" | "budget" | "procurement" | "attachments" | "approval";

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg }: { msg: string }) {
  return (
    <div className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white shadow-lg">
      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
      {msg}
    </div>
  );
}

// ─── Modal wrapper ────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
          <h2 className="text-sm font-semibold text-neutral-900">{title}</h2>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function PifDetailPage() {
  const { fmt: formatDateShort } = useFormatDate();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [actModal, setActModal] = useState<{ open: boolean; editing?: ProgrammeActivity }>({ open: false });
  const [msModal, setMsModal] = useState<{ open: boolean; editing?: ProgrammeMilestone }>({ open: false });
  const [delModal, setDelModal] = useState<{ open: boolean; editing?: ProgrammeDeliverable }>({ open: false });
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [attachments, setAttachments] = useState<ProgrammeAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [chosenQuoteModal, setChosenQuoteModal] = useState<{ open: boolean; attachment: ProgrammeAttachment | null }>({ open: false, attachment: null });
  const [chosenReason, setChosenReason] = useState("");
  const [chosenQuoteSubmitting, setChosenQuoteSubmitting] = useState(false);
  const { confirm } = useConfirm();

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const load = useCallback(() => {
    setLoading(true);
    programmeApi.get(Number(id))
      .then((r) => { setProgramme(r.data); setError(null); })
      .catch(() => setError("Failed to load programme."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const loadAttachments = useCallback(() => {
    if (!id) return;
    setAttachmentsLoading(true);
    programmeApi.listAttachments(Number(id))
      .then((r) => setAttachments(r.data?.data ?? []))
      .catch(() => setAttachments([]))
      .finally(() => setAttachmentsLoading(false));
  }, [id]);
  useEffect(() => {
    if (tab === "attachments" && programme) loadAttachments();
  }, [tab, programme?.id, loadAttachments]);

  // ── Activity form ──────────────────────────────────────────────────────────
  const [actForm, setActForm] = useState({ name: "", description: "", budget_allocation: "", responsible: "", location: "", start_date: "", end_date: "", status: "draft" });

  const openActModal = (a?: ProgrammeActivity) => {
    setActForm(a ? {
      name: a.name, description: a.description ?? "", budget_allocation: String(a.budget_allocation),
      responsible: a.responsible ?? "", location: a.location ?? "",
      start_date: a.start_date, end_date: a.end_date, status: a.status,
    } : { name: "", description: "", budget_allocation: "", responsible: "", location: "", start_date: "", end_date: "", status: "draft" });
    setActModal({ open: true, editing: a });
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programme) return;
    setSubmitting(true);
    const payload = { ...actForm, budget_allocation: parseFloat(actForm.budget_allocation) || 0 } as Partial<ProgrammeActivity>;
    try {
      if (actModal.editing) {
        await programmeApi.updateActivity(programme.id, actModal.editing.id, payload);
        showToast("Activity updated.");
      } else {
        await programmeApi.addActivity(programme.id, payload);
        showToast("Activity added.");
      }
      setActModal({ open: false });
      load();
    } catch { showToast("Failed to save activity."); }
    finally { setSubmitting(false); }
  };

  const handleDeleteActivity = async (actId: number) => {
    if (!programme || !(await confirm({ title: "Delete Activity", message: "Delete this activity?", variant: "danger" }))) return;
    try {
      await programmeApi.deleteActivity(programme.id, actId);
      showToast("Activity deleted.");
      load();
    } catch { showToast("Failed to delete activity."); }
  };

  // ── Milestone form ─────────────────────────────────────────────────────────
  const [msForm, setMsForm] = useState({ name: "", target_date: "", completion_pct: "0", status: "pending" });

  const openMsModal = (m?: ProgrammeMilestone) => {
    setMsForm(m ? {
      name: m.name, target_date: m.target_date,
      completion_pct: String(m.completion_pct), status: m.status,
    } : { name: "", target_date: "", completion_pct: "0", status: "pending" });
    setMsModal({ open: true, editing: m });
  };

  const handleSaveMilestone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programme) return;
    setSubmitting(true);
    const payload = { ...msForm, completion_pct: parseInt(msForm.completion_pct) || 0 } as Partial<ProgrammeMilestone>;
    try {
      if (msModal.editing) {
        await programmeApi.updateMilestone(programme.id, msModal.editing.id, payload);
        showToast("Milestone updated.");
      } else {
        await programmeApi.addMilestone(programme.id, payload);
        showToast("Milestone added.");
      }
      setMsModal({ open: false });
      load();
    } catch { showToast("Failed to save milestone."); }
    finally { setSubmitting(false); }
  };

  // ── Deliverable form ───────────────────────────────────────────────────────
  const [delForm, setDelForm] = useState({ name: "", description: "", due_date: "", status: "pending" });

  const openDelModal = (d?: ProgrammeDeliverable) => {
    setDelForm(d ? { name: d.name, description: d.description ?? "", due_date: d.due_date, status: d.status }
      : { name: "", description: "", due_date: "", status: "pending" });
    setDelModal({ open: true, editing: d });
  };

  const handleSaveDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!programme) return;
    setSubmitting(true);
    try {
      if (delModal.editing) {
        await programmeApi.updateDeliverable(programme.id, delModal.editing.id, delForm as Partial<ProgrammeDeliverable>);
        showToast("Deliverable updated.");
      } else {
        await programmeApi.addDeliverable(programme.id, delForm as Partial<ProgrammeDeliverable>);
        showToast("Deliverable added.");
      }
      setDelModal({ open: false });
      load();
    } catch { showToast("Failed to save deliverable."); }
    finally { setSubmitting(false); }
  };

  // ── Approval actions ───────────────────────────────────────────────────────
  const getApiError = (err: unknown): string => {
    const ax = err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } };
    const msg = ax.response?.data?.message;
    if (msg) return msg;
    const errors = ax.response?.data?.errors;
    if (errors && typeof errors === "object") {
      const first = Object.values(errors).flat()[0];
      if (first) return first;
    }
    return "";
  };

  const handleSubmitProgramme = async () => {
    if (!programme) return;
    setSubmitting(true);
    try {
      await programmeApi.submit(programme.id);
      showToast("Programme submitted for approval.");
      load();
    } catch (err) {
      showToast(getApiError(err) || "Failed to submit.");
    }
    finally { setSubmitting(false); }
  };

  const handleApproveProgramme = async () => {
    if (!programme) return;
    setSubmitting(true);
    try {
      await programmeApi.approve(programme.id);
      showToast("Programme approved.");
      load();
    } catch (err) {
      showToast(getApiError(err) || "Failed to approve.");
    }
    finally { setSubmitting(false); }
  };

  const handleRejectProgramme = async () => {
    if (!programme || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await programmeApi.reject(programme.id, rejectReason);
      showToast("Programme rejected.");
      setRejectModal(false);
      setRejectReason("");
      load();
    } catch (err) {
      showToast(getApiError(err) || "Failed to reject.");
    }
    finally { setSubmitting(false); }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">Loading programme…</span>
      </div>
    );
  }
  if (error || !programme) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error ?? "Programme not found."}
        </div>
        <Link href="/pif" className="btn-secondary px-4 py-2 text-sm inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to Programmes
        </Link>
      </div>
    );
  }

  const activities = programme.activities ?? [];
  const milestones = programme.milestones ?? [];
  const deliverables = programme.deliverables ?? [];
  const budgetLines = (programme as { budgetLines?: Programme["budget_lines"] }).budgetLines ?? programme.budget_lines ?? [];
  const procItems = (programme as { procurementItems?: Programme["procurement_items"] }).procurementItems ?? programme.procurement_items ?? [];

  const totalBudgeted = budgetLines.reduce((s, b) => s + (Number((b as { amount?: number }).amount) || 0), 0);
  const totalSpent = budgetLines.reduce((s, b) => s + (Number((b as { actual_spent?: number }).actual_spent) || 0), 0);
  const budgetPct = totalBudgeted > 0 ? Math.round((totalSpent / totalBudgeted) * 100) : 0;

  const TABS: { key: DetailTab; label: string; icon: string }[] = [
    { key: "overview", label: "Overview", icon: "dashboard" },
    { key: "activities", label: "Activities", icon: "checklist" },
    { key: "milestones", label: "Milestones & Del.", icon: "flag" },
    { key: "budget", label: "Budget", icon: "payments" },
    { key: "procurement", label: "Procurement", icon: "shopping_cart" },
    { key: "attachments", label: "Attachments", icon: "attach_file" },
    { key: "approval", label: "Approval", icon: "approval" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      {toast && <Toast msg={toast} />}

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/pif" className="hover:text-primary transition-colors">Programmes</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{programme.reference_number}</span>
      </div>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
              <span className="material-symbols-outlined text-primary" style={{ fontSize: "30px" }}>account_tree</span>
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-neutral-400">{programme.reference_number}</span>
                <span className={`badge ${STATUS_BADGE[programme.status] ?? "badge-muted"}`}>
                  {STATUS_LABEL[programme.status] ?? programme.status}
                </span>
              </div>
              <h1 className="text-xl font-bold text-neutral-900 mt-0.5">{programme.title}</h1>
              {programme.background && (
                <p className="text-sm text-neutral-500 mt-1 line-clamp-2">{programme.background}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={() => setTab("attachments")}
              className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[15px]">upload_file</span>
              <span className="hidden sm:inline">Submit evidence</span>
            </button>
            {programme.status === "draft" && (
              <>
                <Link
                  href={`/pif/${programme.id}/edit`}
                  className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirm({ title: "Delete Draft", message: "Delete this draft programme? This cannot be undone.", variant: "danger" }))) return;
                    try {
                      await programmeApi.delete(programme.id);
                      router.push("/pif");
                    } catch {
                      showToast("Failed to delete programme.");
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  Delete
                </button>
              </>
            )}
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-neutral-100 pt-5">
          <div>
            <p className="text-xs text-neutral-400">Funding Source{programme.funding_sources && programme.funding_sources.length > 1 ? "s" : ""}</p>
            <div className="text-sm font-semibold text-neutral-800 mt-0.5">
              {programme.funding_sources && programme.funding_sources.length > 0
                ? programme.funding_sources.map((fs, i) => (
                    <p key={i}>{fs.name}{fs.budget_amount != null ? ` (${programme.primary_currency} ${Number(fs.budget_amount).toLocaleString()})` : ""}</p>
                  ))
                : (programme.funding_source ?? "—")}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Total Budget</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {programme.primary_currency} {Number(programme.total_budget).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Responsible Officer{programme.responsible_officer_ids && programme.responsible_officer_ids.length > 1 ? "s" : ""}</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {(() => {
                const ids = programme.responsible_officer_ids;
                const ro = programme.responsible_officer_user;
                if (ids && ids.length > 0) {
                  const first = ro && typeof ro === "object" && "name" in ro ? ro.name : (typeof programme.responsible_officer === "string" && programme.responsible_officer ? programme.responsible_officer : null);
                  return first ? (ids.length > 1 ? `${first}, +${ids.length - 1} more` : first) : `${ids.length} assigned`;
                }
                if (ro && typeof ro === "object" && "name" in ro) return ro.name;
                if (typeof programme.responsible_officer === "string" && programme.responsible_officer) return programme.responsible_officer;
                return "—";
              })()}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">Duration</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {formatDateShort(programme.start_date)} → {formatDateShort(programme.end_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex-shrink-0 ${tab === t.key
              ? "border-primary text-primary"
              : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {programme.background && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Background</h3>
              <p className="text-sm text-neutral-700 leading-relaxed">{programme.background}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {programme.overall_objective && (
              <div className="card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Overall Objective</h3>
                <p className="text-sm text-neutral-700">{programme.overall_objective}</p>
              </div>
            )}
            {(programme.specific_objectives ?? []).length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Specific Objectives</h3>
                <ul className="space-y-2">
                  {(programme.specific_objectives ?? []).map((o, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-neutral-700">
                      <span className="material-symbols-outlined text-primary text-[16px] mt-0.5 flex-shrink-0">arrow_right</span>
                      {o}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {(programme.target_beneficiaries ?? []).length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Target Beneficiaries</h3>
              <div className="flex flex-wrap gap-2">
                {(programme.target_beneficiaries ?? []).map((b, i) => (
                  <span key={i} className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{b}</span>
                ))}
              </div>
            </div>
          )}
          {((programme.strategic_alignment ?? []).length > 0 || (programme.strategic_pillars ?? []).length > 0 || programme.strategic_pillar) && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Strategic Alignment</h3>
              {(programme.strategic_alignment ?? []).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {(programme.strategic_alignment ?? []).map((a, i) => (
                    <span key={i} className="inline-flex items-center rounded-lg bg-neutral-100 px-2.5 py-1 text-xs font-medium text-neutral-700">{a}</span>
                  ))}
                </div>
              )}
              {(programme.strategic_pillars ?? []).length > 0 ? (
                <div className="flex flex-wrap gap-2 mt-2">
                  {(programme.strategic_pillars ?? []).map((p, i) => (
                    <span key={i} className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{p}</span>
                  ))}
                </div>
              ) : programme.strategic_pillar ? (
                <p className="text-xs text-neutral-500 mt-2">Pillar: <span className="font-semibold text-neutral-700">{programme.strategic_pillar}</span></p>
              ) : null}
            </div>
          )}
          {((programme.implementing_departments ?? []).length > 0 || programme.implementing_department) && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Implementing Department(s)</h3>
              <div className="flex flex-wrap gap-2">
                {(programme.implementing_departments ?? []).length > 0
                  ? (programme.implementing_departments ?? []).map((d, i) => (
                      <span key={i} className="inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{d}</span>
                    ))
                  : programme.implementing_department && (
                      <span className="inline-flex items-center rounded-lg bg-teal-50 px-2.5 py-1 text-xs font-medium text-teal-800">{programme.implementing_department}</span>
                    )}
              </div>
            </div>
          )}
          {(programme.funding_sources ?? []).length > 0 && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">Funding Sources</h3>
              <div className="space-y-2">
                {(programme.funding_sources ?? []).map((fs, i) => (
                  <div key={i} className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <span className="font-semibold text-neutral-800">{fs.name}</span>
                    {fs.budget_amount != null && <span className="text-neutral-600">{programme.primary_currency} {Number(fs.budget_amount).toLocaleString()}</span>}
                    {fs.pays_for && <span className="text-neutral-500 italic">— {fs.pays_for}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ACTIVITIES TAB ───────────────────────────────────────────────────── */}
      {tab === "activities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">{activities.length} activit{activities.length === 1 ? "y" : "ies"} registered</p>
            <button type="button" onClick={() => openActModal()} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">add</span>
              Add Activity
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Name</th><th>Responsible</th><th>Budget</th><th>Dates</th><th>Status</th><th></th></tr>
                </thead>
                <tbody>
                  {activities.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400">No activities yet.</td></tr>
                  ) : activities.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <p className="font-medium text-neutral-900">{a.name}</p>
                        {a.description && <p className="text-xs text-neutral-400 mt-0.5">{a.description}</p>}
                      </td>
                      <td className="text-neutral-600">{a.responsible ?? "—"}</td>
                      <td className="text-neutral-700">
                        {programme.primary_currency} {Number(a.budget_allocation).toLocaleString()}
                      </td>
                      <td className="text-xs text-neutral-500 whitespace-nowrap">{formatDateShort(a.start_date)} → {formatDateShort(a.end_date)}</td>
                      <td><span className={`badge ${ACT_BADGE[a.status] ?? "badge-muted"} capitalize`}>{a.status.replace(/_/g, " ")}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openActModal(a)} className="text-xs text-neutral-400 hover:text-primary">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button type="button" onClick={() => handleDeleteActivity(a.id)} className="text-xs text-neutral-400 hover:text-red-500">
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── MILESTONES & DELIVERABLES TAB ────────────────────────────────────── */}
      {tab === "milestones" && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Milestones */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Milestones</h3>
              <button type="button" onClick={() => openMsModal()} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add
              </button>
            </div>
            {milestones.length === 0 ? (
              <div className="card p-8 text-center text-sm text-neutral-400">No milestones yet.</div>
            ) : milestones.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{m.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">Target: {formatDateShort(m.target_date)}{m.achieved_date ? ` · Achieved: ${formatDateShort(m.achieved_date)}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`badge ${MS_BADGE[m.status] ?? "badge-muted"} capitalize`}>{m.status}</span>
                    <button type="button" onClick={() => openMsModal(m)} className="text-neutral-300 hover:text-primary ml-1">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>
                </div>
                <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className={`h-1.5 rounded-full transition-all ${m.completion_pct >= 100 ? "bg-green-500" : m.completion_pct >= 50 ? "bg-primary" : "bg-amber-400"}`}
                    style={{ width: `${Math.min(m.completion_pct, 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-neutral-400 mt-1">{m.completion_pct}% complete</p>
              </div>
            ))}
          </div>

          {/* Deliverables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Deliverables</h3>
              <button type="button" onClick={() => openDelModal()} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add
              </button>
            </div>
            {deliverables.length === 0 ? (
              <div className="card p-8 text-center text-sm text-neutral-400">No deliverables yet.</div>
            ) : deliverables.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{d.name}</p>
                    {d.description && <p className="text-xs text-neutral-400 mt-0.5">{d.description}</p>}
                    <p className="text-xs text-neutral-400 mt-1">Due: {formatDateShort(d.due_date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`badge ${DEL_BADGE[d.status] ?? "badge-muted"} capitalize`}>{d.status}</span>
                    <button type="button" onClick={() => openDelModal(d)} className="text-neutral-300 hover:text-primary ml-1">
                      <span className="material-symbols-outlined text-[16px]">edit</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BUDGET TAB ───────────────────────────────────────────────────────── */}
      {tab === "budget" && (
        <div className="space-y-4">
          {/* Utilisation summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-neutral-900">Budget Utilisation</h3>
              <span className="text-sm font-bold text-neutral-700">{budgetPct}%</span>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-400" : "bg-green-500"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
              <span>{programme.primary_currency} {totalSpent.toLocaleString()} spent</span>
              <span>{programme.primary_currency} {totalBudgeted.toLocaleString()} total</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Funding Source</th>
                    <th className="text-right">Budgeted</th>
                    <th className="text-right">Actual Spent</th>
                    <th className="text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetLines.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400">No budget lines.</td></tr>
                  ) : budgetLines.map((b) => {
                    const variance = Number(b.amount) - Number(b.actual_spent);
                    return (
                      <tr key={b.id}>
                        <td><span className="badge badge-muted capitalize">{b.category.replace(/_/g, " ")}</span></td>
                        <td className="text-neutral-700">{b.description}</td>
                        <td className="text-xs text-neutral-500 capitalize">{b.funding_source.replace(/_/g, " ")}</td>
                        <td className="text-right font-mono text-sm">{programme.primary_currency} {Number(b.amount).toLocaleString()}</td>
                        <td className="text-right font-mono text-sm">{programme.primary_currency} {Number(b.actual_spent).toLocaleString()}</td>
                        <td className={`text-right font-mono text-sm font-semibold ${variance >= 0 ? "text-green-600" : "text-red-500"}`}>
                          {variance >= 0 ? "+" : ""}{variance.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {budgetLines.length > 0 && (
                  <tfoot>
                    <tr className="bg-neutral-50 font-semibold">
                      <td colSpan={3} className="text-sm text-neutral-700">Totals</td>
                      <td className="text-right font-mono text-sm">{programme.primary_currency} {totalBudgeted.toLocaleString()}</td>
                      <td className="text-right font-mono text-sm">{programme.primary_currency} {totalSpent.toLocaleString()}</td>
                      <td className={`text-right font-mono text-sm font-bold ${totalBudgeted - totalSpent >= 0 ? "text-green-600" : "text-red-500"}`}>
                        {totalBudgeted - totalSpent >= 0 ? "+" : ""}{(totalBudgeted - totalSpent).toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PROCUREMENT TAB ──────────────────────────────────────────────────── */}
      {tab === "procurement" && (
        <div className="card overflow-hidden">
          {!programme.procurement_required ? (
            <div className="p-8 text-center">
              <span className="material-symbols-outlined text-4xl text-neutral-200">shopping_cart_off</span>
              <p className="mt-3 text-sm text-neutral-400">No procurement requirements for this programme.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Description</th><th>Method</th><th>Estimated Cost</th><th>Vendor</th><th>Delivery Date</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {procItems.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-sm text-neutral-400">No procurement items.</td></tr>
                  ) : procItems.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium text-neutral-900">{p.description}</td>
                      <td><span className="badge badge-muted">{METHOD_LABEL[p.method] ?? p.method}</span></td>
                      <td className="font-mono text-sm">{programme.primary_currency} {Number(p.estimated_cost).toLocaleString()}</td>
                      <td className="text-neutral-600">{p.vendor ?? "—"}</td>
                      <td className="text-xs text-neutral-500">{p.delivery_date ?? "—"}</td>
                      <td><span className={`badge ${PROC_BADGE[p.status] ?? "badge-muted"} capitalize`}>{p.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ATTACHMENTS TAB ──────────────────────────────────────────────────── */}
      {chosenQuoteModal.open && chosenQuoteModal.attachment && (
        <Modal
          title="Set as chosen quote"
          onClose={() => setChosenQuoteModal({ open: false, attachment: null })}
        >
          <p className="text-sm text-neutral-600 mb-3">
            Record why this quote was selected: <strong>{chosenQuoteModal.attachment.original_filename}</strong>
          </p>
          <textarea
            value={chosenReason}
            onChange={(e) => setChosenReason(e.target.value)}
            placeholder="Reason for selecting this quote…"
            rows={4}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setChosenQuoteModal({ open: false, attachment: null })}
              className="btn-secondary py-2 px-4 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={chosenQuoteSubmitting}
              onClick={async () => {
                if (!programme || !chosenQuoteModal.attachment) return;
                setChosenQuoteSubmitting(true);
                try {
                  await programmeApi.updateAttachment(programme.id, chosenQuoteModal.attachment.id, {
                    is_chosen_quote: true,
                    selection_reason: chosenReason.trim() || null,
                  });
                  showToast("Chosen quote updated.");
                  loadAttachments();
                  setChosenQuoteModal({ open: false, attachment: null });
                } catch {
                  showToast("Failed to update.");
                } finally {
                  setChosenQuoteSubmitting(false);
                }
              }}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
            >
              {chosenQuoteSubmitting ? "Saving…" : "Save"}
            </button>
          </div>
        </Modal>
      )}

      {tab === "attachments" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">Upload attachment</h3>
            <p className="text-xs text-neutral-500 mb-3">Upload all quotes used for services (hotel, transport, other), one or more memos, or concept notes.</p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fileInput = form.querySelector<HTMLInputElement>('input[name="attachment_file"]');
                const typeSelect = form.querySelector<HTMLSelectElement>('select[name="attachment_type"]');
                const file = fileInput?.files?.[0];
                const docType = typeSelect?.value as ProgrammeAttachmentType | undefined;
                if (!programme || !file || !docType) return;
                setUploadSubmitting(true);
                try {
                  await programmeApi.uploadAttachment(programme.id, file, docType);
                  showToast("Attachment uploaded.");
                  loadAttachments();
                  form.reset();
                  fileInput.value = "";
                } catch {
                  showToast("Upload failed.");
                } finally {
                  setUploadSubmitting(false);
                }
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[140px]">
                <label className="block text-xs font-medium text-neutral-500 mb-1">Type</label>
                <select
                  name="attachment_type"
                  required
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">Select type…</option>
                  {(Object.keys(ATTACHMENT_TYPE_LABEL) as ProgrammeAttachmentType[]).map((t) => (
                    <option key={t} value={t}>{ATTACHMENT_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label className="block text-xs font-medium text-neutral-500 mb-1">File</label>
                <input
                  name="attachment_file"
                  type="file"
                  required
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-700 file:mr-2 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-primary"
                />
              </div>
              <button
                type="submit"
                disabled={uploadSubmitting}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2 disabled:opacity-50"
              >
                {uploadSubmitting ? (
                  <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
                ) : (
                  <span className="material-symbols-outlined text-[18px]">upload_file</span>
                )}
                Upload
              </button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">Attachments</h3>
              <button type="button" onClick={loadAttachments} className="text-xs text-neutral-500 hover:text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                Refresh
              </button>
            </div>
            {attachmentsLoading ? (
              <div className="flex items-center justify-center py-12 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[22px] mr-2">progress_activity</span>
                <span className="text-sm">Loading attachments…</span>
              </div>
            ) : attachments.length === 0 ? (
              <div className="py-10 text-center text-sm text-neutral-400">No attachments yet. Upload a concept note, memo, or quote above.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>File name</th>
                      <th>Size</th>
                      <th>Uploaded by</th>
                      <th>Date</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {attachments.map((a) => {
                      const isQuoteType = a.document_type != null && QUOTE_ATTACHMENT_TYPES.includes(a.document_type);
                      const isChosen = a.is_chosen_quote === true;
                      return (
                        <tr key={a.id}>
                          <td>
                            <div className="flex flex-col gap-1">
                              <span className="badge badge-muted">
                                {a.document_type ? ATTACHMENT_TYPE_LABEL[a.document_type] ?? a.document_type : "—"}
                              </span>
                              {isChosen && (
                                <>
                                  <span className="badge bg-green-100 text-green-800 text-xs">Chosen quote</span>
                                  {a.selection_reason && (
                                    <p className="text-xs text-neutral-600 mt-0.5 max-w-[200px]" title={a.selection_reason}>
                                      {a.selection_reason}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                          <td className="font-medium text-neutral-900">{a.original_filename}</td>
                          <td className="text-neutral-500 text-sm">
                            {a.size_bytes != null ? (a.size_bytes < 1024 ? `${a.size_bytes} B` : `${(a.size_bytes / 1024).toFixed(1)} KB`) : "—"}
                          </td>
                          <td className="text-neutral-600 text-sm">{a.uploader?.name ?? "—"}</td>
                          <td className="text-neutral-500 text-sm whitespace-nowrap">{formatDateShort(a.created_at)}</td>
                          <td>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isQuoteType && (
                                isChosen ? (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!programme) return;
                                      try {
                                        await programmeApi.updateAttachment(programme.id, a.id, { is_chosen_quote: false, selection_reason: null });
                                        showToast("Chosen quote cleared.");
                                        loadAttachments();
                                      } catch {
                                        showToast("Failed to update.");
                                      }
                                    }}
                                    className="text-neutral-400 hover:text-amber-600 text-xs"
                                    title="Clear chosen"
                                  >
                                    Clear chosen
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChosenQuoteModal({ open: true, attachment: a });
                                      setChosenReason(a.selection_reason ?? "");
                                    }}
                                    className="text-xs text-primary hover:underline"
                                    title="Mark as chosen quote"
                                  >
                                    Mark as chosen
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                onClick={() => programmeApi.downloadAttachment(programme!.id, a.id, a.original_filename)}
                                className="text-neutral-400 hover:text-primary"
                                title="Download"
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!programme || !(await confirm({ title: "Delete attachment", message: `Remove "${a.original_filename}"?`, variant: "danger" }))) return;
                                  try {
                                    await programmeApi.deleteAttachment(programme.id, a.id);
                                    showToast("Attachment removed.");
                                    loadAttachments();
                                  } catch {
                                    showToast("Failed to delete.");
                                  }
                                }}
                                className="text-neutral-400 hover:text-red-500"
                                title="Delete"
                              >
                                <span className="material-symbols-outlined text-[18px]">delete</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── APPROVAL TAB ─────────────────────────────────────────────────────── */}
      {tab === "approval" && (
        <div className="space-y-6">
          {/* Workflow timeline */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-6">Approval Workflow</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-100" />
              <div className="space-y-6">
                {[
                  {
                    step: "Drafted",
                    icon: "edit_note",
                    done: true,
                    active: programme.status === "draft",
                    date: programme.created_at,
                    by: programme.creator?.name,
                  },
                  {
                    step: "Submitted for Approval",
                    icon: "send",
                    done: programme.status !== "draft",
                    active: programme.status === "submitted",
                    date: programme.submitted_at,
                    by: null,
                  },
                  {
                    step: programme.status === "rejected" ? "Rejected" : "Approved",
                    icon: programme.status === "rejected" ? "cancel" : "check_circle",
                    done: ["approved", "active", "completed", "rejected"].includes(programme.status),
                    active: ["approved", "active", "rejected"].includes(programme.status),
                    date: programme.approved_at,
                    by: programme.approver?.name,
                    isReject: programme.status === "rejected",
                  },
                  {
                    step: "Active Implementation",
                    icon: "play_circle",
                    done: ["active", "completed"].includes(programme.status),
                    active: programme.status === "active",
                    date: null,
                    by: null,
                  },
                ].map((s, i) => (
                  <div key={i} className="flex items-start gap-4 pl-0">
                    <div className={`relative z-10 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-2 ${s.isReject ? "border-red-400 bg-red-50" :
                      s.done ? "border-green-500 bg-green-50" :
                        s.active ? "border-primary bg-primary/10" :
                          "border-neutral-200 bg-white"
                      }`}>
                      <span className={`material-symbols-outlined text-[16px] ${s.isReject ? "text-red-500" :
                        s.done ? "text-green-600" :
                          s.active ? "text-primary" :
                            "text-neutral-300"
                        }`} style={{ fontVariationSettings: s.done ? "'FILL' 1" : "'FILL' 0" }}>{s.icon}</span>
                    </div>
                    <div className="flex-1 pb-2">
                      <p className={`text-sm font-semibold ${s.done || s.active ? "text-neutral-900" : "text-neutral-400"}`}>{s.step}</p>
                      {(s.date || s.by) && (
                        <p className="text-xs text-neutral-400 mt-0.5">
                          {s.date && formatDateShort(s.date)}
                          {s.by && ` · ${s.by}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Rejection reason if rejected */}
          {programme.status === "rejected" && programme.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">Rejection Reason</p>
              <p className="text-sm text-red-800">{programme.rejection_reason}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Actions</h3>
            <div className="flex flex-wrap gap-3">
              {programme.status === "draft" && (
                <button
                  type="button"
                  onClick={handleSubmitProgramme}
                  disabled={submitting}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  Submit for Approval
                </button>
              )}
              {programme.status === "submitted" && (
                <>
                  <button
                    type="button"
                    onClick={handleApproveProgramme}
                    disabled={submitting}
                    className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60 bg-green-600 hover:bg-green-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModal(true)}
                    disabled={submitting}
                    className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    Reject
                  </button>
                </>
              )}
              {!["draft", "submitted"].includes(programme.status) && (
                <p className="text-sm text-neutral-400">No actions available for status: {STATUS_LABEL[programme.status] ?? programme.status}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY MODAL ───────────────────────────────────────────────────── */}
      {actModal.open && (
        <Modal title={actModal.editing ? "Edit Activity" : "Add Activity"} onClose={() => setActModal({ open: false })}>
          <form onSubmit={handleSaveActivity} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
              <input required className="form-input" value={actForm.name} onChange={(e) => setActForm({ ...actForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea rows={2} className="form-input resize-none" value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Budget ({programme.primary_currency})</label>
                <input type="number" min="0" className="form-input" value={actForm.budget_allocation} onChange={(e) => setActForm({ ...actForm, budget_allocation: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Responsible</label>
                <input className="form-input" value={actForm.responsible} onChange={(e) => setActForm({ ...actForm, responsible: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Start Date</label>
                <input type="date" className="form-input" value={actForm.start_date} onChange={(e) => setActForm({ ...actForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">End Date</label>
                <input type="date" className="form-input" value={actForm.end_date} onChange={(e) => setActForm({ ...actForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
              <select className="form-input" value={actForm.status} onChange={(e) => setActForm({ ...actForm, status: e.target.value })}>
                {["draft", "approved", "in_progress", "completed", "postponed", "cancelled"].map((s) => (
                  <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setActModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MILESTONE MODAL ──────────────────────────────────────────────────── */}
      {msModal.open && (
        <Modal title={msModal.editing ? "Edit Milestone" : "Add Milestone"} onClose={() => setMsModal({ open: false })}>
          <form onSubmit={handleSaveMilestone} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
              <input required className="form-input" value={msForm.name} onChange={(e) => setMsForm({ ...msForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Target Date</label>
                <input type="date" className="form-input" value={msForm.target_date} onChange={(e) => setMsForm({ ...msForm, target_date: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Completion %</label>
                <input type="number" min="0" max="100" className="form-input" value={msForm.completion_pct} onChange={(e) => setMsForm({ ...msForm, completion_pct: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
              <select className="form-input" value={msForm.status} onChange={(e) => setMsForm({ ...msForm, status: e.target.value })}>
                {["pending", "achieved", "missed"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setMsModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── DELIVERABLE MODAL ────────────────────────────────────────────────── */}
      {delModal.open && (
        <Modal title={delModal.editing ? "Edit Deliverable" : "Add Deliverable"} onClose={() => setDelModal({ open: false })}>
          <form onSubmit={handleSaveDeliverable} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Name *</label>
              <input required className="form-input" value={delForm.name} onChange={(e) => setDelForm({ ...delForm, name: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Description</label>
              <textarea rows={2} className="form-input resize-none" value={delForm.description} onChange={(e) => setDelForm({ ...delForm, description: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Due Date</label>
              <input type="date" className="form-input" value={delForm.due_date} onChange={(e) => setDelForm({ ...delForm, due_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">Status</label>
              <select className="form-input" value={delForm.status} onChange={(e) => setDelForm({ ...delForm, status: e.target.value })}>
                {["pending", "submitted", "accepted"].map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDelModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── REJECT MODAL ─────────────────────────────────────────────────────── */}
      {rejectModal && (
        <Modal title="Reject Programme" onClose={() => setRejectModal(false)}>
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Reason for rejection <span className="text-red-500">*</span></label>
              <textarea
                rows={3}
                className="form-input resize-none"
                placeholder="Provide a clear reason…"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setRejectModal(false)} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
              <button
                type="button"
                onClick={handleRejectProgramme}
                disabled={!rejectReason.trim() || submitting}
                className="btn-primary px-5 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                Reject Programme
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
