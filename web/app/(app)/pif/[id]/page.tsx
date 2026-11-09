"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFormatDate } from "@/lib/useFormatDate";
import {
  programmeApi,
  tenantUsersApi,
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
import ReadOnlySections from "./ReadOnlySections";
import { Modal, STATUS_BADGE, STATUS_LABEL, ME_STATUS_LABEL, ME_STATUS_BADGE, ACT_BADGE, MS_BADGE, DEL_BADGE, DECLARATION_TEXT, PROC_BADGE, METHOD_LABEL, ATTACHMENT_TYPE_LABEL, type DetailTab } from "./pifDetailShared";
import { apiErrorMessage } from "@/lib/apiError";
import { ProgrammeTimeline } from "@/components/programmes/ProgrammeTimeline";
import PifFinanceBudgetCertify from "@/components/budget/PifFinanceBudgetCertify";
import { CreateAssignmentFromSourceModal } from "@/components/assignments/CreateAssignmentFromSourceModal";
import { SigningModal } from "@/components/saam/SigningModal";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { unwrapEntity } from "@/lib/unwrapEntity";
import { AuditTimeline } from "@/components/audit/AuditTimeline";
import { useToast } from "@/components/ui/Toast";
import { personLabel } from "@/lib/pifForm";
import { TableEmpty, EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

// ─── Main component ───────────────────────────────────────────────────────────
export default function PifDetailPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { t } = useI18n();
  const { fmt: formatDateShort } = useFormatDate();
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [programme, setProgramme] = useState<Programme | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [submitting, setSubmitting] = useState(false);

  // Modal state
  const [actModal, setActModal] = useState<{ open: boolean; editing?: ProgrammeActivity }>({ open: false });
  const [msModal, setMsModal] = useState<{ open: boolean; editing?: ProgrammeMilestone }>({ open: false });
  const [delModal, setDelModal] = useState<{ open: boolean; editing?: ProgrammeDeliverable }>({ open: false });
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [declarationConfirmed, setDeclarationConfirmed] = useState(false);
  const [attachments, setAttachments] = useState<ProgrammeAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [uploadSubmitting, setUploadSubmitting] = useState(false);
  const [chosenQuoteModal, setChosenQuoteModal] = useState<{ open: boolean; attachment: ProgrammeAttachment | null }>({ open: false, attachment: null });
  const [chosenReason, setChosenReason] = useState("");
  const [chosenQuoteSubmitting, setChosenQuoteSubmitting] = useState(false);
  const [tenantUsers, setTenantUsers] = useState<{ id: number; name: string; email: string }[]>([]);
  const [amending, setAmending] = useState(false);
  const [selectedProcIds, setSelectedProcIds] = useState<number[]>([]);
  const [sendProcModal, setSendProcModal] = useState(false);
  const [sendProcTitle, setSendProcTitle] = useState("");
  const [sendProcCategory, setSendProcCategory] = useState("goods");
  const [sendProcSubmitting, setSendProcSubmitting] = useState(false);
  const [sendTravelModal, setSendTravelModal] = useState(false);
  const [selectedTravellerIds, setSelectedTravellerIds] = useState<number[]>([]);
  const [sendTravelSubmitting, setSendTravelSubmitting] = useState(false);
  const [missionTitle, setMissionTitle] = useState("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [signModal, setSignModal] = useState(false);
  const { confirm } = useConfirm();


  const load = useCallback(() => {
    setLoading(true);
    programmeApi.get(Number(id))
      .then((r) => {
        const entity = unwrapEntity<Programme>(r.data);
        if (!entity) {
          setProgramme(null);
          setError(t("pif.detail.notFoundUnexpected"));
          return;
        }
        setProgramme(entity);
        setError(null);
      })
      .catch(() => {
        setProgramme(null);
        setError(t("pif.detail.loadFailed"));
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    tenantUsersApi.list().then((r) => setTenantUsers(r.data.data ?? [])).catch(() => {});
  }, []);

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
        success(t("pif.detail.toast.activityUpdated"));
      } else {
        await programmeApi.addActivity(programme.id, payload);
        success(t("pif.detail.toast.activityAdded"));
      }
      setActModal({ open: false });
      load();
    } catch { showErrorToast(t("pif.detail.toast.activitySaveFailed")); }
    finally { setSubmitting(false); }
  };

  const handleDeleteActivity = async (actId: number) => {
    if (!programme || !(await confirm({ title: "pif.detail.deleteActivityTitle", message: "pif.detail.deleteActivityMessage", variant: "danger" }))) return;
    try {
      await programmeApi.deleteActivity(programme.id, actId);
      success(t("pif.detail.toast.activityDeleted"));
      load();
    } catch { showErrorToast(t("pif.detail.toast.activityDeleteFailed")); }
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
        success(t("pif.detail.toast.milestoneUpdated"));
      } else {
        await programmeApi.addMilestone(programme.id, payload);
        success(t("pif.detail.toast.milestoneAdded"));
      }
      setMsModal({ open: false });
      load();
    } catch { showErrorToast(t("pif.detail.toast.milestoneSaveFailed")); }
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
        success(t("pif.detail.toast.deliverableUpdated"));
      } else {
        await programmeApi.addDeliverable(programme.id, delForm as Partial<ProgrammeDeliverable>);
        success(t("pif.detail.toast.deliverableAdded"));
      }
      setDelModal({ open: false });
      load();
    } catch { showErrorToast(t("pif.detail.toast.deliverableSaveFailed")); }
    finally { setSubmitting(false); }
  };

  // ── Approval actions ───────────────────────────────────────────────────────
  const handleSubmitProgramme = async () => {
    if (!programme || !declarationConfirmed) return;
    setSubmitting(true);
    try {
      await programmeApi.submit(programme.id, { declaration_confirmed: declarationConfirmed });
      success(t("pif.detail.toast.submitted"));
      setDeclarationConfirmed(false);
      load();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, t("pif.detail.toast.submitFailed")));
    }
    finally { setSubmitting(false); }
  };

  const handleApproveProgramme = async (confirmPassword?: string) => {
    if (!programme) return;
    setSubmitting(true);
    try {
      await programmeApi.approve(programme.id, undefined, confirmPassword);
      success(confirmPassword ? t("pif.detail.toast.signedApproved") : t("pif.detail.toast.approved"));
      setSignModal(false);
      load();
    } catch (err) {
      const ax = err as { response?: { data?: { errors?: Record<string, string[]> } } };
      if (!confirmPassword && (ax.response?.data?.errors?.confirm_password || ax.response?.data?.errors?.signature)) {
        setSignModal(true);
        return;
      }
      showErrorToast(apiErrorMessage(err, t("pif.detail.toast.approveFailed")));
    }
    finally { setSubmitting(false); }
  };

  const handleAmendProgramme = async () => {
    if (!programme) return;
    if (!(await confirm({
      title: "pif.detail.amendTitle",
      message: "pif.detail.amendMessage",
    }))) return;
    setAmending(true);
    try {
      const res = await programmeApi.amend(programme.id);
      success(t("pif.detail.toast.amendmentCreated"));
      router.push(`/pif/${res.data.data.id}/edit`);
    } catch (err) {
      showErrorToast(apiErrorMessage(err, t("pif.detail.toast.amendmentFailed")));
    } finally {
      setAmending(false);
    }
  };

  const handleRejectProgramme = async () => {
    if (!programme || !rejectReason.trim()) return;
    setSubmitting(true);
    try {
      await programmeApi.reject(programme.id, rejectReason);
      success(t("pif.detail.toast.rejected"));
      setRejectModal(false);
      setRejectReason("");
      load();
    } catch (err) {
      showErrorToast(apiErrorMessage(err, t("pif.detail.toast.rejectFailed")));
    }
    finally { setSubmitting(false); }
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-neutral-400">
        <span className="material-symbols-outlined animate-spin text-[24px] mr-2">progress_activity</span>
        <span className="text-sm">{t("pif.detail.loading")}</span>
      </div>
    );
  }
  if (error || !programme) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error ?? t("pif.detail.notFound")}
        </div>
        <button type="button" className="btn-secondary text-sm" onClick={() => load()}>
          {t("common.retry")}
        </button>
        <Link href="/pif" className="btn-secondary inline-flex items-center gap-1 px-4 py-2 text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("pif.detail.backToList")}
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
    { key: "overview", label: "pif.detail.tab.overview", icon: "dashboard" },
    { key: "logistics", label: "pif.detail.tab.logistics", icon: "fact_check" },
    { key: "activities", label: "pif.detail.tab.activities", icon: "checklist" },
    { key: "milestones", label: "pif.detail.tab.milestones", icon: "flag" },
    { key: "budget", label: "pif.detail.tab.budget", icon: "payments" },
    { key: "procurement", label: "pif.detail.tab.procurement", icon: "shopping_cart" },
    { key: "attachments", label: "pif.detail.tab.attachments", icon: "attach_file" },
    { key: "timeline", label: "pif.detail.tab.timeline", icon: "timeline" },
    { key: "approval", label: "pif.detail.tab.approval", icon: "approval" },
  ];

  return (
    <div className="w-full min-w-0 space-y-6">

      <ModulePageHeader
        title={programme.title || t("pif.detail.untitled")}
        subtitle={
          programme.background ? (
            <span className="line-clamp-2">{programme.background}</span>
          ) : (
            t("pif.detail.subtitle")
          )
        }
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "pif.common.programmes", href: "/pif" },
              { label: programme.reference_number ?? t("pif.detail.pifNumber", { id: programme.id }) },
            ]}
          />
        }
        meta={
          <>
            <span className="font-mono text-xs text-neutral-400">{programme.reference_number}</span>
            <span className={`badge ${STATUS_BADGE[programme.status] ?? "badge-muted"}`}>
              {STATUS_LABEL[programme.status] ? t(STATUS_LABEL[programme.status]) : programme.status}
            </span>
            <span
              className={`badge ${ME_STATUS_BADGE[programme.me_status] ?? "badge-muted"}`}
              title={t("pif.detail.meStatusTitle")}
            >
              {t("pif.detail.meBadge", { status: ME_STATUS_LABEL[programme.me_status] ? t(ME_STATUS_LABEL[programme.me_status]) : programme.me_status })}
            </span>
          </>
        }
        actions={
          <>
            <a
              href={programmeApi.pdfUrl(programme.id)}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary px-3 py-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
              <span className="hidden sm:inline">{t("pif.detail.downloadPdf")}</span>
            </a>
            {["approved", "active", "on_hold", "completed", "amended"].includes(programme.status) && (
              <button
                type="button"
                onClick={() => setShowAssignModal(true)}
                className="btn-secondary px-3 py-1.5 text-xs"
                title={t("pif.detail.createAssignmentTitle")}
              >
                <span className="material-symbols-outlined text-[15px]">assignment_ind</span>
                <span className="hidden sm:inline">{t("pif.detail.createAssignment")}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setTab("attachments")}
              className="btn-primary px-3 py-1.5 text-xs"
            >
              <span className="material-symbols-outlined text-[15px]">upload_file</span>
              <span className="hidden sm:inline">{t("pif.detail.submitEvidence")}</span>
            </button>
            {programme.status === "draft" && (
              <>
                <Link href={`/pif/${programme.id}/edit`} className="btn-secondary px-3 py-1.5 text-xs">
                  <span className="material-symbols-outlined text-[15px]">edit</span>
                  {t("common.edit")}
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    if (!(await confirm({ title: "pif.detail.deleteDraftTitle", message: "pif.detail.deleteDraftMessage", variant: "danger" }))) return;
                    try {
                      await programmeApi.delete(programme.id);
                      router.push("/pif");
                    } catch {
                      showErrorToast(t("pif.detail.toast.deleteFailed"));
                    }
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                >
                  <span className="material-symbols-outlined text-[15px]">delete</span>
                  {t("common.delete")}
                </button>
              </>
            )}
          </>
        }
      />

      <WorkflowStatusBanner
        status={programme.status}
        currentStage={STATUS_LABEL[programme.status] ? t(STATUS_LABEL[programme.status]) : programme.status}
        currentHolder={personLabel(programme.responsible_officer, t("pif.detail.responsibleOfficerFallback"))}
        extras={[
          { label: t("pif.detail.meShort"), value: ME_STATUS_LABEL[programme.me_status] ? t(ME_STATUS_LABEL[programme.me_status]) : programme.me_status ?? "—" },
        ]}
      />

      <div className="card p-6">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-neutral-400">{programme.funding_sources && programme.funding_sources.length > 1 ? t("pif.detail.fundingSources") : t("pif.list.fundingSource")}</p>
            <div className="mt-0.5 text-sm font-semibold text-neutral-800">
              {programme.funding_sources && programme.funding_sources.length > 0
                ? programme.funding_sources.map((fs, i) => (
                    <p key={i}>{fs.name}{fs.budget_amount != null ? ` (${programme.primary_currency} ${Number(fs.budget_amount).toLocaleString()})` : ""}</p>
                  ))
                : (programme.funding_source ?? "—")}
            </div>
          </div>
          <div>
            <p className="text-xs text-neutral-400">{t("pif.detail.totalBudget")}</p>
            <p className="mt-0.5 text-sm font-semibold text-neutral-800">
              {programme.primary_currency} {Number(programme.total_budget).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">{programme.responsible_officer_ids && programme.responsible_officer_ids.length > 1 ? t("pif.detail.responsibleOfficers") : t("pif.detail.responsibleOfficer")}</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {(() => {
                const ids = programme.responsible_officer_ids;
                const named = personLabel(
                  programme.responsible_officer_user ?? programme.responsible_officer,
                  ""
                );
                if (ids && ids.length > 1) {
                  return named ? t("pif.detail.namedMore", { name: named, count: ids.length - 1 }) : t("pif.detail.assignedCount", { count: ids.length });
                }
                return named || "—";
              })()}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-400">{t("pif.detail.duration")}</p>
            <p className="text-sm font-semibold text-neutral-800 mt-0.5">
              {formatDateShort(programme.start_date)} → {formatDateShort(programme.end_date)}
            </p>
          </div>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-neutral-200 overflow-x-auto">
        {TABS.map((tb) => (
          <button
            key={tb.key}
            type="button"
            onClick={() => setTab(tb.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap flex-shrink-0 ${tab === tb.key
              ? "border-primary text-primary"
              : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300"
              }`}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 0" }}>{tb.icon}</span>
            {t(tb.label)}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {programme.background && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.background")}</h3>
              <p className="text-sm text-neutral-700 leading-relaxed">{programme.background}</p>
            </div>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {programme.overall_objective && (
              <div className="card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.overallObjective")}</h3>
                <p className="text-sm text-neutral-700">{programme.overall_objective}</p>
              </div>
            )}
            {(programme.specific_objectives ?? []).length > 0 && (
              <div className="card p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.specificObjectives")}</h3>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.targetBeneficiaries")}</h3>
              <div className="flex flex-wrap gap-2">
                {(programme.target_beneficiaries ?? []).map((b, i) => (
                  <span key={i} className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">{b}</span>
                ))}
              </div>
            </div>
          )}
          {((programme.strategic_alignment ?? []).length > 0 || (programme.strategic_pillars ?? []).length > 0 || programme.strategic_pillar) && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.strategicAlignment")}</h3>
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
                <p className="text-xs text-neutral-500 mt-2">{t("pif.detail.pillar")} <span className="font-semibold text-neutral-700">{programme.strategic_pillar}</span></p>
              ) : null}
            </div>
          )}
          {((programme.implementing_departments ?? []).length > 0 || programme.implementing_department) && (
            <div className="card p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.implementingDepartments")}</h3>
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
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">{t("pif.detail.fundingSourcesTitle")}</h3>
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

      {/* ── LOGISTICS & COMPLIANCE TAB ───────────────────────────────────────── */}
      {tab === "logistics" && (
        <div className="space-y-6">
          <PifFinanceBudgetCertify
            programme={programme}
            onUpdated={(updated) => setProgramme(updated)}
          />
          <ReadOnlySections programme={programme} tenantUsers={tenantUsers} />
        </div>
      )}

      {/* ── ACTIVITIES TAB ───────────────────────────────────────────────────── */}
      {tab === "activities" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-500">{t(activities.length === 1 ? "pif.detail.activitiesOne" : "pif.detail.activitiesOther", { count: activities.length })}</p>
            <button type="button" onClick={() => openActModal()} className="btn-primary py-1.5 px-3 text-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">add</span>
              {t("pif.detail.addActivity")}
            </button>
          </div>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>{t("pif.detail.name")}</th><th>{t("pif.list.responsible")}</th><th>{t("pif.list.budget")}</th><th>{t("pif.detail.dates")}</th><th>{t("pif.list.status")}</th><th></th></tr>
                </thead>
                <tbody>
                  {activities.length === 0 ? (
                    <TableEmpty colSpan={6} title="pif.detail.noActivities" />
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
                      <td><span className={`badge ${ACT_BADGE[a.status] ?? "badge-muted"} capitalize`}>{a.status in ACT_BADGE ? t(`pif.detail.actStatus.${a.status}`) : a.status.replace(/_/g, " ")}</span></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => openActModal(a)} aria-label={t("common.edit")} className="text-xs text-neutral-400 hover:text-primary">
                            <span className="material-symbols-outlined text-[16px]">edit</span>
                          </button>
                          <button type="button" onClick={() => handleDeleteActivity(a.id)} aria-label={t("common.delete")} className="text-xs text-neutral-400 hover:text-red-500">
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
              <h3 className="text-sm font-semibold text-neutral-900">{t("pif.detail.milestones")}</h3>
              <button type="button" onClick={() => openMsModal()} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>
                {t("common.add")}
              </button>
            </div>
            {milestones.length === 0 ? (
              <div className="card">
                <EmptyState icon="flag" title="pif.detail.noMilestones" />
              </div>
            ) : milestones.map((m) => (
              <div key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{m.name}</p>
                    <p className="text-xs text-neutral-400 mt-0.5">{t("pif.detail.target", { date: formatDateShort(m.target_date) })}{m.achieved_date ? ` · ${t("pif.detail.achieved", { date: formatDateShort(m.achieved_date) })}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`badge ${MS_BADGE[m.status] ?? "badge-muted"} capitalize`}>{m.status in MS_BADGE ? t(`pif.detail.itemStatus.${m.status}`) : m.status}</span>
                    <button type="button" onClick={() => openMsModal(m)} aria-label={t("common.edit")} className="text-neutral-300 hover:text-primary ml-1">
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
                <p className="text-[11px] text-neutral-400 mt-1">{t("pif.detail.percentComplete", { pct: m.completion_pct })}</p>
              </div>
            ))}
          </div>

          {/* Deliverables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">{t("pif.detail.deliverables")}</h3>
              <button type="button" onClick={() => openDelModal()} className="btn-secondary py-1 px-2.5 text-xs flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>
                {t("common.add")}
              </button>
            </div>
            {deliverables.length === 0 ? (
              <div className="card">
                <EmptyState icon="inventory_2" title="pif.detail.noDeliverables" />
              </div>
            ) : deliverables.map((d) => (
              <div key={d.id} className="card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-neutral-900">{d.name}</p>
                    {d.description && <p className="text-xs text-neutral-400 mt-0.5">{d.description}</p>}
                    <p className="text-xs text-neutral-400 mt-1">{t("pif.detail.dueOn", { date: formatDateShort(d.due_date) })}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className={`badge ${DEL_BADGE[d.status] ?? "badge-muted"} capitalize`}>{d.status in DEL_BADGE ? t(`pif.detail.itemStatus.${d.status}`) : d.status}</span>
                    <button type="button" onClick={() => openDelModal(d)} aria-label={t("common.edit")} className="text-neutral-300 hover:text-primary ml-1">
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
              <h3 className="text-sm font-semibold text-neutral-900">{t("pif.detail.budgetUtilisation")}</h3>
              <span className="text-sm font-bold text-neutral-700">{budgetPct}%</span>
            </div>
            <div className="h-2.5 bg-neutral-100 rounded-full overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all ${budgetPct > 90 ? "bg-red-500" : budgetPct > 70 ? "bg-amber-400" : "bg-green-500"}`}
                style={{ width: `${Math.min(budgetPct, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between mt-2 text-xs text-neutral-500">
              <span>{t("pif.detail.spentAmount", { amount: `${programme.primary_currency} ${totalSpent.toLocaleString()}` })}</span>
              <span>{t("pif.detail.totalAmount", { amount: `${programme.primary_currency} ${totalBudgeted.toLocaleString()}` })}</span>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>{t("pif.detail.category")}</th>
                    <th>{t("pif.detail.description")}</th>
                    <th>{t("pif.list.fundingSource")}</th>
                    <th className="text-right">{t("pif.detail.budgeted")}</th>
                    <th className="text-right">{t("pif.detail.actualSpent")}</th>
                    <th className="text-right">{t("pif.detail.variance")}</th>
                  </tr>
                </thead>
                <tbody>
                  {budgetLines.length === 0 ? (
                    <TableEmpty colSpan={6} title="pif.detail.noBudgetLines" />
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
                      <td colSpan={3} className="text-sm text-neutral-700">{t("pif.detail.totals")}</td>
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
              <p className="mt-3 text-sm text-neutral-400">{t("pif.detail.noProcurement")}</p>
            </div>
          ) : (
            <>
              {["approved", "amended"].includes(programme.status) && procItems.some((p) => !p.procurement_request_id) && (
                <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-5 py-3 bg-neutral-50/60">
                  <p className="text-xs text-neutral-500">
                    {t("pif.detail.selectProcItems")}
                  </p>
                  <button
                    type="button"
                    className="btn-primary text-xs py-1.5 px-3 disabled:opacity-50"
                    disabled={selectedProcIds.length === 0}
                    onClick={() => {
                      setSendProcTitle(t("pif.detail.procPackageTitle", { title: programme.title }));
                      setSendProcModal(true);
                    }}
                  >
                    {t("pif.detail.sendToProcurementCount", { count: selectedProcIds.length })}
                  </button>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      {["approved", "amended"].includes(programme.status) && <th className="w-10"></th>}
                      <th>{t("pif.detail.description")}</th>
                      <th>{t("pif.detail.method")}</th>
                      <th>{t("pif.detail.estimatedCost")}</th>
                      <th>{t("pif.detail.vendor")}</th>
                      <th>{t("pif.detail.deliveryDate")}</th>
                      <th>{t("pif.list.status")}</th>
                      <th>{t("pif.detail.linked")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {procItems.length === 0 ? (
                      <TableEmpty colSpan={8} title="pif.detail.noProcItems" />
                    ) : procItems.map((p) => {
                      const linked = !!p.procurement_request_id;
                      const selectable = ["approved", "amended"].includes(programme.status) && !linked;
                      return (
                        <tr key={p.id} className={linked ? "opacity-60" : undefined}>
                          {["approved", "amended"].includes(programme.status) && (
                            <td>
                              <input
                                type="checkbox"
                                disabled={!selectable}
                                checked={selectedProcIds.includes(p.id)}
                                onChange={(e) => {
                                  setSelectedProcIds((prev) =>
                                    e.target.checked ? [...prev, p.id] : prev.filter((x) => x !== p.id)
                                  );
                                }}
                              />
                            </td>
                          )}
                          <td className="font-medium text-neutral-900">{p.description}</td>
                          <td><span className="badge badge-muted">{METHOD_LABEL[p.method] ? t(METHOD_LABEL[p.method]) : p.method}</span></td>
                          <td className="font-mono text-sm">{programme.primary_currency} {Number(p.estimated_cost).toLocaleString()}</td>
                          <td className="text-neutral-600">{p.vendor ?? "—"}</td>
                          <td className="text-xs text-neutral-500">{p.delivery_date ?? "—"}</td>
                          <td><span className={`badge ${PROC_BADGE[p.status] ?? "badge-muted"} capitalize`}>{p.status}</span></td>
                          <td className="text-xs">
                            {linked ? (
                              <Link href={`/procurement/${p.procurement_request_id}`} className="btn-secondary text-xs py-1 px-2">
                                {t("pif.detail.prqLinked")}
                              </Link>
                            ) : (
                              <span className="text-neutral-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {sendProcModal && programme && (
        <Modal title="pif.detail.sendToProcurement" onClose={() => setSendProcModal(false)}>
          <p className="text-sm text-neutral-600 mb-4">
            {t("pif.detail.sendProcHint", { count: selectedProcIds.length })}
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="pif-detail-request-title" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.requestTitle")}</label>
              <input id="pif-detail-request-title"
                className="form-input w-full"
                value={sendProcTitle}
                onChange={(e) => setSendProcTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="pif-detail-category" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.category")}</label>
              <select id="pif-detail-category" className="form-input w-full" value={sendProcCategory} onChange={(e) => setSendProcCategory(e.target.value)}>
                <option value="goods">{t("pif.detail.procCategory.goods")}</option>
                <option value="services">{t("pif.detail.procCategory.services")}</option>
                <option value="works">{t("pif.detail.procCategory.works")}</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={() => setSendProcModal(false)}>
              {t("common.cancel")}
            </button>
            <button
              type="button"
              disabled={sendProcSubmitting || !sendProcTitle.trim()}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
              onClick={async () => {
                setSendProcSubmitting(true);
                try {
                  const res = await programmeApi.sendToProcurement(programme.id, {
                    procurement_item_ids: selectedProcIds,
                    request_title: sendProcTitle.trim(),
                    category: sendProcCategory,
                  });
                  success(res.data.message ?? t("pif.detail.toast.sentToProcurement"));
                  setSendProcModal(false);
                  setSelectedProcIds([]);
                  load();
                } catch {
                  showErrorToast(t("pif.detail.toast.sendProcFailed"));
                } finally {
                  setSendProcSubmitting(false);
                }
              }}
            >
              {sendProcSubmitting ? t("pif.detail.sending") : t("pif.detail.sendToProcurement")}
            </button>
          </div>
        </Modal>
      )}

      {sendTravelModal && programme && (
        <Modal title="pif.detail.sendToTravel" onClose={() => setSendTravelModal(false)}>
          <p className="text-sm text-neutral-600 mb-4">
            {t("pif.detail.sendTravelHint")}
          </p>
          <div className="space-y-3">
            <div>
              <label htmlFor="pif-detail-mission-title-optional-light-group" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.missionTitle")}</label>
              <input id="pif-detail-mission-title-optional-light-group" className="form-input w-full" value={missionTitle} onChange={(e) => setMissionTitle(e.target.value)} />
            </div>
            <div>
              <p className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.travellers")}</p>
              <div className="max-h-48 overflow-y-auto border rounded-lg p-2 space-y-1">
                {tenantUsers.map((u) => (
                  <label htmlFor={`pif-detail-traveller-${u.id}`} key={u.id} className="flex items-center gap-2 text-sm py-1 px-1 hover:bg-neutral-50 rounded">
                    <input id={`pif-detail-traveller-${u.id}`}
                      type="checkbox"
                      checked={selectedTravellerIds.includes(u.id)}
                      onChange={(e) => {
                        setSelectedTravellerIds((prev) =>
                          e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id)
                        );
                      }}
                    />
                    <span>{u.name}</span>
                    <span className="text-xs text-neutral-400">{u.email}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-5">
            <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={() => setSendTravelModal(false)}>{t("common.cancel")}</button>
            <button
              type="button"
              disabled={sendTravelSubmitting || selectedTravellerIds.length === 0}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
              onClick={async () => {
                setSendTravelSubmitting(true);
                try {
                  const res = await programmeApi.sendToTravel(programme.id, {
                    traveller_ids: selectedTravellerIds,
                    mission_title: missionTitle.trim() || undefined,
                    purpose: programme.title,
                  });
                  success(res.data.message ?? t("pif.detail.toast.sentToTravel"));
                  setSendTravelModal(false);
                } catch {
                  showErrorToast(t("pif.detail.toast.sendTravelFailed"));
                } finally {
                  setSendTravelSubmitting(false);
                }
              }}
            >
              {sendTravelSubmitting ? t("pif.detail.sending") : t("pif.detail.createRequisitions", { count: selectedTravellerIds.length || "" })}
            </button>
          </div>
        </Modal>
      )}

      {/* ── ATTACHMENTS TAB ──────────────────────────────────────────────────── */}
      {chosenQuoteModal.open && chosenQuoteModal.attachment && (
        <Modal
          title="pif.detail.setChosenQuote"
          onClose={() => setChosenQuoteModal({ open: false, attachment: null })}
        >
          <p className="text-sm text-neutral-600 mb-3">
            {t("pif.detail.chosenQuoteHint")} <strong>{chosenQuoteModal.attachment.original_filename}</strong>
          </p>
          <textarea
            value={chosenReason}
            onChange={(e) => setChosenReason(e.target.value)}
            placeholder={t("pif.detail.chosenQuotePlaceholder")}
            rows={4}
            className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setChosenQuoteModal({ open: false, attachment: null })}
              className="btn-secondary py-2 px-4 text-sm"
            >
              {t("common.cancel")}
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
                  success(t("pif.detail.toast.chosenQuoteUpdated"));
                  loadAttachments();
                  setChosenQuoteModal({ open: false, attachment: null });
                } catch {
                  showErrorToast(t("pif.detail.toast.updateFailed"));
                } finally {
                  setChosenQuoteSubmitting(false);
                }
              }}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-50"
            >
              {chosenQuoteSubmitting ? t("hr.positions.form.saving") : t("common.save")}
            </button>
          </div>
        </Modal>
      )}

      {tab === "attachments" && (
        <div className="space-y-4">
          <div className="card p-4">
            <h3 className="text-sm font-semibold text-neutral-900 mb-3">{t("pif.detail.uploadAttachment")}</h3>
            <p className="text-xs text-neutral-500 mb-3">{t("pif.detail.uploadHint")}</p>
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
                  success(t("pif.detail.toast.attachmentUploaded"));
                  loadAttachments();
                  form.reset();
                  fileInput.value = "";
                } catch {
                  showErrorToast(t("pif.detail.toast.uploadFailed"));
                } finally {
                  setUploadSubmitting(false);
                }
              }}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex-1 min-w-[140px]">
                <label htmlFor="pif-detail-type" className="block text-xs font-medium text-neutral-500 mb-1">{t("pif.detail.type")}</label>
                <select id="pif-detail-type"
                  name="attachment_type"
                  required
                  className="w-full rounded-lg border border-neutral-200 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary"
                >
                  <option value="">{t("pif.detail.selectType")}</option>
                  {(Object.keys(ATTACHMENT_TYPE_LABEL) as ProgrammeAttachmentType[]).map((at) => (
                    <option key={at} value={at}>{t(ATTACHMENT_TYPE_LABEL[at])}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[180px]">
                <label htmlFor="pif-detail-file" className="block text-xs font-medium text-neutral-500 mb-1">{t("pif.detail.file")}</label>
                <input id="pif-detail-file"
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
                {t("common.upload")}
              </button>
            </form>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">{t("pif.detail.tab.attachments")}</h3>
              <button type="button" onClick={loadAttachments} className="text-xs text-neutral-500 hover:text-primary flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">refresh</span>
                {t("pif.detail.refresh")}
              </button>
            </div>
            {attachmentsLoading ? (
              <div className="flex items-center justify-center py-12 text-neutral-400">
                <span className="material-symbols-outlined animate-spin text-[22px] mr-2">progress_activity</span>
                <span className="text-sm">{t("pif.detail.loadingAttachments")}</span>
              </div>
            ) : attachments.length === 0 ? (
              <div className="py-10 text-center text-sm text-neutral-400">{t("pif.detail.noAttachments")}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>{t("pif.detail.type")}</th>
                      <th>{t("pif.detail.fileName")}</th>
                      <th>{t("pif.detail.size")}</th>
                      <th>{t("pif.detail.uploadedBy")}</th>
                      <th>{t("pif.detail.date")}</th>
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
                                {a.document_type ? (ATTACHMENT_TYPE_LABEL[a.document_type] ? t(ATTACHMENT_TYPE_LABEL[a.document_type]) : a.document_type) : "—"}
                              </span>
                              {isChosen && (
                                <>
                                  <span className="badge bg-green-100 text-green-800 text-xs">{t("pif.detail.chosenQuote")}</span>
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
                                        success(t("pif.detail.toast.chosenQuoteCleared"));
                                        loadAttachments();
                                      } catch {
                                        showErrorToast(t("pif.detail.toast.updateFailed"));
                                      }
                                    }}
                                    className="text-neutral-400 hover:text-amber-600 text-xs"
                                    title={t("pif.detail.clearChosen")}
                                  >
                                    {t("pif.detail.clearChosen")}
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setChosenQuoteModal({ open: true, attachment: a });
                                      setChosenReason(a.selection_reason ?? "");
                                    }}
                                    className="btn-secondary text-xs py-1 px-2"
                                    title={t("pif.detail.markChosenTitle")}
                                  >
                                    {t("pif.detail.markChosen")}
                                  </button>
                                )
                              )}
                              <button
                                type="button"
                                onClick={() => programmeApi.downloadAttachment(programme!.id, a.id, a.original_filename)}
                                className="text-neutral-400 hover:text-primary"
                                title={t("common.download")}
                                aria-label={t("common.download")}
                              >
                                <span className="material-symbols-outlined text-[18px]">download</span>
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!programme || !(await confirm({ title: "pif.detail.deleteAttachmentTitle", message: t("pif.detail.deleteAttachmentMessage", { name: a.original_filename }), variant: "danger" }))) return;
                                  try {
                                    await programmeApi.deleteAttachment(programme.id, a.id);
                                    success(t("pif.detail.toast.attachmentRemoved"));
                                    loadAttachments();
                                  } catch {
                                    showErrorToast(t("pif.detail.toast.deleteAttachmentFailed"));
                                  }
                                }}
                                className="text-neutral-400 hover:text-red-500"
                                title={t("common.delete")}
                                aria-label={t("common.delete")}
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
      {tab === "timeline" && programme && <ProgrammeTimeline programmeId={programme.id} />}

      {tab === "approval" && (
        <div className="space-y-6">
          {/* Workflow timeline */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-neutral-900 mb-6">{t("pif.detail.approvalWorkflow")}</h3>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-neutral-100" />
              <div className="space-y-6">
                {[
                  {
                    step: t("pif.detail.step.drafted"),
                    icon: "edit_note",
                    done: true,
                    active: programme.status === "draft",
                    date: programme.created_at,
                    by: programme.creator?.name,
                  },
                  {
                    step: t("pif.detail.step.submitted"),
                    icon: "send",
                    done: programme.status !== "draft",
                    active: programme.status === "submitted",
                    date: programme.submitted_at,
                    by: null,
                  },
                  {
                    step: programme.status === "rejected" ? t("pif.status.rejected") : t("pif.status.approved"),
                    icon: programme.status === "rejected" ? "cancel" : "check_circle",
                    done: ["approved", "active", "completed", "rejected"].includes(programme.status),
                    active: ["approved", "active", "rejected"].includes(programme.status),
                    date: programme.approved_at,
                    by: programme.approver?.name,
                    isReject: programme.status === "rejected",
                  },
                  {
                    step: t("pif.detail.step.active"),
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

          <AuditTimeline
            subjectType="Programme"
            subjectId={programme.id}
            title={t("pif.detail.auditTrail")}
          />

          {/* Rejection reason if rejected */}
          {programme.status === "rejected" && programme.rejection_reason && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-wider text-red-500 mb-1">{t("pif.detail.rejectionReason")}</p>
              <p className="text-sm text-red-800">{programme.rejection_reason}</p>
            </div>
          )}

          {/* Action buttons */}
          <div className="card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">{t("pif.detail.actions")}</h3>
            {programme.status === "draft" && (
              <div className="mb-4 rounded-xl border border-neutral-200 bg-neutral-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-2">{t("pif.detail.declarationTitle")}</p>
                <p className="text-sm text-neutral-700 mb-3">{t(DECLARATION_TEXT)}</p>
                <label htmlFor="pif-detail-setdeclarationconfirmed-e-target-checked-classna" className="flex items-start gap-2 cursor-pointer">
                  <input id="pif-detail-setdeclarationconfirmed-e-target-checked-classna"
                    type="checkbox"
                    checked={declarationConfirmed}
                    onChange={(e) => setDeclarationConfirmed(e.target.checked)}
                    className="mt-0.5 rounded border-neutral-300"
                  />
                  <span className="text-sm font-medium text-neutral-800">{t("pif.detail.confirmDeclaration")}</span>
                </label>
              </div>
            )}
            <div className="flex flex-wrap gap-3">
              {programme.status === "draft" && (
                <button
                  type="button"
                  onClick={handleSubmitProgramme}
                  disabled={submitting || !declarationConfirmed}
                  className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">send</span>
                  {t("pif.detail.submitForApproval")}
                </button>
              )}
              {programme.status === "submitted" && (
                <>
                  <button
                    type="button"
                    onClick={() => void handleApproveProgramme()}
                    disabled={submitting}
                    className="btn-primary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60 bg-green-600 hover:bg-green-700"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    {t("common.approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectModal(true)}
                    disabled={submitting}
                    className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50 disabled:opacity-60"
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    {t("common.reject")}
                  </button>
                </>
              )}
              {/* Amend: mirrors the backend guard Programme::isApprovedOrAmended() —
                  only a PIF whose status is literally 'approved' or 'amended' may be
                  amended (not 'active'/'completed'/etc., even though those are also
                  post-approval states). Attempting this server-side on any other
                  status raises a 422 ("Only approved programmes can be amended."),
                  so gating the button the same way avoids a round-trip failure. */}
              {["approved", "amended"].includes(programme.status) && (
                <button
                  type="button"
                  onClick={() => {
                    setMissionTitle(t("pif.detail.travelMissionTitle", { title: programme.title }));
                    setSelectedTravellerIds([]);
                    setSendTravelModal(true);
                  }}
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">flight_takeoff</span>
                  {t("pif.detail.sendToTravel")}
                </button>
              )}
              {["approved", "amended"].includes(programme.status) && (
                <button
                  type="button"
                  onClick={handleAmendProgramme}
                  disabled={amending}
                  className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[16px]">edit_document</span>
                  {amending ? t("pif.detail.creatingAmendment") : t("pif.detail.amend")}
                </button>
              )}
              {!["draft", "submitted", "approved", "amended"].includes(programme.status) && (
                <p className="text-sm text-neutral-400">{t("pif.detail.noActions", { status: STATUS_LABEL[programme.status] ? t(STATUS_LABEL[programme.status]) : programme.status })}</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── ACTIVITY MODAL ───────────────────────────────────────────────────── */}
      {actModal.open && (
        <Modal title={actModal.editing ? "pif.detail.editActivity" : "pif.detail.addActivity"} onClose={() => setActModal({ open: false })}>
          <form onSubmit={handleSaveActivity} className="space-y-3">
            <div>
              <label htmlFor="pif-detail-name" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.nameRequired")}</label>
              <input id="pif-detail-name" required className="form-input" value={actForm.name} onChange={(e) => setActForm({ ...actForm, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="pif-detail-description" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.description")}</label>
              <textarea id="pif-detail-description" rows={2} className="form-input resize-none" value={actForm.description} onChange={(e) => setActForm({ ...actForm, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pif-detail-budget" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.budgetIn", { currency: programme.primary_currency ?? "" })}</label>
                <input id="pif-detail-budget" type="number" min="0" className="form-input" value={actForm.budget_allocation} onChange={(e) => setActForm({ ...actForm, budget_allocation: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pif-detail-responsible" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.list.responsible")}</label>
                <input id="pif-detail-responsible" className="form-input" value={actForm.responsible} onChange={(e) => setActForm({ ...actForm, responsible: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pif-detail-start-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.startDate")}</label>
                <input id="pif-detail-start-date" type="date" className="form-input" value={actForm.start_date} onChange={(e) => setActForm({ ...actForm, start_date: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pif-detail-end-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.list.endDate")}</label>
                <input id="pif-detail-end-date" type="date" className="form-input" value={actForm.end_date} onChange={(e) => setActForm({ ...actForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="pif-detail-status" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.list.status")}</label>
              <select id="pif-detail-status" className="form-input" value={actForm.status} onChange={(e) => setActForm({ ...actForm, status: e.target.value })}>
                {["draft", "approved", "in_progress", "completed", "postponed", "cancelled"].map((s) => (
                  <option key={s} value={s}>{t(`pif.detail.actStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setActModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? t("hr.positions.form.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── MILESTONE MODAL ──────────────────────────────────────────────────── */}
      {msModal.open && (
        <Modal title={msModal.editing ? "pif.detail.editMilestone" : "pif.detail.addMilestone"} onClose={() => setMsModal({ open: false })}>
          <form onSubmit={handleSaveMilestone} className="space-y-3">
            <div>
              <label htmlFor="pif-detail-name-2" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.nameRequired")}</label>
              <input id="pif-detail-name-2" required className="form-input" value={msForm.name} onChange={(e) => setMsForm({ ...msForm, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="pif-detail-target-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.targetDate")}</label>
                <input id="pif-detail-target-date" type="date" className="form-input" value={msForm.target_date} onChange={(e) => setMsForm({ ...msForm, target_date: e.target.value })} />
              </div>
              <div>
                <label htmlFor="pif-detail-completion" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.completion")}</label>
                <input id="pif-detail-completion" type="number" min="0" max="100" className="form-input" value={msForm.completion_pct} onChange={(e) => setMsForm({ ...msForm, completion_pct: e.target.value })} />
              </div>
            </div>
            <div>
              <label htmlFor="pif-detail-status-2" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.list.status")}</label>
              <select id="pif-detail-status-2" className="form-input" value={msForm.status} onChange={(e) => setMsForm({ ...msForm, status: e.target.value })}>
                {["pending", "achieved", "missed"].map((s) => (
                  <option key={s} value={s}>{t(`pif.detail.itemStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setMsModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? t("hr.positions.form.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── DELIVERABLE MODAL ────────────────────────────────────────────────── */}
      {delModal.open && (
        <Modal title={delModal.editing ? "pif.detail.editDeliverable" : "pif.detail.addDeliverable"} onClose={() => setDelModal({ open: false })}>
          <form onSubmit={handleSaveDeliverable} className="space-y-3">
            <div>
              <label htmlFor="pif-detail-name-3" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.nameRequired")}</label>
              <input id="pif-detail-name-3" required className="form-input" value={delForm.name} onChange={(e) => setDelForm({ ...delForm, name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="pif-detail-description-2" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.description")}</label>
              <textarea id="pif-detail-description-2" rows={2} className="form-input resize-none" value={delForm.description} onChange={(e) => setDelForm({ ...delForm, description: e.target.value })} />
            </div>
            <div>
              <label htmlFor="pif-detail-due-date" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.detail.dueDate")}</label>
              <input id="pif-detail-due-date" type="date" className="form-input" value={delForm.due_date} onChange={(e) => setDelForm({ ...delForm, due_date: e.target.value })} />
            </div>
            <div>
              <label htmlFor="pif-detail-status-3" className="block text-xs font-semibold text-neutral-700 mb-1">{t("pif.list.status")}</label>
              <select id="pif-detail-status-3" className="form-input" value={delForm.status} onChange={(e) => setDelForm({ ...delForm, status: e.target.value })}>
                {["pending", "submitted", "accepted"].map((s) => (
                  <option key={s} value={s}>{t(`pif.detail.itemStatus.${s}`)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setDelModal({ open: false })} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button type="submit" disabled={submitting} className="btn-primary px-4 py-2 text-sm disabled:opacity-60">
                {submitting ? t("hr.positions.form.saving") : t("common.save")}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── REJECT MODAL ─────────────────────────────────────────────────────── */}
      {rejectModal && (
        <Modal title="pif.detail.rejectProgramme" onClose={() => setRejectModal(false)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="pif-detail-reason-for-rejection" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("pif.detail.rejectReason")} <span className="text-red-500">*</span></label>
              <textarea id="pif-detail-reason-for-rejection"
                rows={3}
                className="form-input resize-none"
                placeholder={t("pif.detail.rejectPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
            </div>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setRejectModal(false)} className="btn-secondary px-4 py-2 text-sm">{t("common.cancel")}</button>
              <button
                type="button"
                onClick={handleRejectProgramme}
                disabled={!rejectReason.trim() || submitting}
                className="btn-primary px-5 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:opacity-50"
              >
                {t("pif.detail.rejectProgramme")}
              </button>
            </div>
          </div>
        </Modal>
      )}

      <CreateAssignmentFromSourceModal
        open={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        sourceType="pif"
        sourceId={programme.id}
        sourcePurpose={programme.me_status && programme.me_status !== "not_yet_linked" ? "me_follow_up" : "programme_action"}
        defaultTitle={t("pif.detail.followUpTitle", { title: programme.title })}
        defaultDescription={programme.background || t("pif.detail.followUpDescription", { ref: programme.reference_number ?? programme.id })}
        defaultDueDate={programme.end_date ?? null}
        defaultAssigneeId={programme.responsible_officer_id ?? programme.responsible_officer_ids?.[0] ?? null}
        sourceReference={programme.reference_number}
        sourceTitle={programme.title}
      />
      {signModal && (
        <SigningModal
          isOpen
          onClose={() => setSignModal(false)}
          signableType="programmes"
          signableId={programme.id}
          action="approve"
          title={t("pif.detail.signApprove")}
          onWorkflowApprove={async ({ password }) => {
            await handleApproveProgramme(password);
          }}
        />
      )}
    </div>
  );
}
