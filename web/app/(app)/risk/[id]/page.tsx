"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useState, useEffect, use } from "react";
import Link from "next/link";
import { riskApi, riskAttachmentsApi, policyApi, type Risk, type RiskAction, type RiskHistory, type RiskAttachment, type RiskDocumentType, type Policy } from "@/lib/api";
import { readStoredUser } from "@/lib/session";
import { useFormatDate } from "@/lib/useFormatDate";
import RiskDocumentsPanel from "@/components/ui/RiskDocumentsPanel";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import { ApplyMitigationFields, EMPTY_MITIGATION, type MitigationDraft } from "@/components/risk/ApplyMitigationFields";
import { buildMitigationFormData } from "@/lib/riskLookups";
import { apiErrorMessage } from "@/lib/apiError";
import axios from "axios";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";

// ── Config ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "risk.analytics.status.draft",      cls: "text-neutral-600 bg-neutral-100 border-neutral-200", icon: "edit_note"       },
  submitted:  { label: "risk.analytics.status.submitted",  cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"         },
  reviewed:   { label: "risk.analytics.status.reviewed",   cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "rate_review"     },
  approved:   { label: "risk.analytics.status.approved",   cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"    },
  monitoring: { label: "risk.analytics.status.monitoring", cls: "text-teal-700 bg-teal-50 border-teal-200",           icon: "monitor_heart"   },
  escalated:  { label: "risk.analytics.status.escalated",  cls: "text-red-700 bg-red-50 border-red-200",              icon: "warning"         },
  closed:     { label: "risk.analytics.status.closed",     cls: "text-neutral-600 bg-neutral-100 border-neutral-200", icon: "lock"            },
  archived:   { label: "risk.analytics.status.archived",   cls: "text-neutral-500 bg-neutral-50 border-neutral-200",  icon: "archive"         },
};

const LEVEL_CONFIG: Record<string, { label: string; cls: string; bar: string }> = {
  low:      { label: "risk.create.level.low",      cls: "text-green-700 bg-green-100 border-green-300",      bar: "bg-green-500"  },
  medium:   { label: "risk.create.level.medium",   cls: "text-yellow-700 bg-yellow-100 border-yellow-300",   bar: "bg-yellow-500" },
  high:     { label: "risk.create.level.high",     cls: "text-orange-700 bg-orange-100 border-orange-300",   bar: "bg-orange-500" },
  critical: { label: "risk.create.level.critical", cls: "text-red-700 bg-red-100 border-red-300",            bar: "bg-red-600"    },
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

const WORKFLOW_ACTIONS = ["submit", "review", "approve", "escalate", "close", "archive", "reopen"];

/** Translated label for an enum value, falling back to the raw value when no key exists. */
function enumLabel(t: (key: string) => string, key: string, fallback: string): string {
  const label = t(key);
  return label === key ? fallback : label;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Translated label for a risk history change type. */
function changeTypeLabel(t: (key: string) => string, type: string): string {
  const key = ["created", "updated", "reopened", "action_added", "action_completed"].includes(type)
    ? `risk.auditTrail.event.${type.replace(/_(\w)/g, (_, c: string) => c.toUpperCase())}`
    : `risk.analytics.status.${type}`;
  return enumLabel(t, key, type.replace(/_/g, " "));
}

function getStoredUser(): { roles?: string[]; id?: number } | null {
  return readStoredUser();
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
  const { t } = useI18n();
  const toast = useToast();

  const [risk, setRisk]       = useState<Risk | null>(null);
  const [actions, setActions] = useState<RiskAction[]>([]);
  const [history, setHistory] = useState<RiskHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ roles?: string[]; id?: number } | null>(null);

  // Action form
  const [showActionForm, setShowActionForm] = useState(false);
  const [actionForm, setActionForm] = useState<MitigationDraft>(EMPTY_MITIGATION);
  const [savingAction, setSavingAction] = useState(false);

  // Workflow modals
  const [modal, setModal]         = useState<string | null>(null);
  const [modalData, setModalData] = useState<Record<string, string>>({});
  const [working, setWorking]     = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"details" | "documents" | "policies">("details");

  // Attachments
  const [attachments, setAttachments] = useState<RiskAttachment[]>([]);
  const [uploading, setUploading]     = useState(false);

  // Related policies
  const [relatedPolicies, setRelatedPolicies] = useState<Policy[]>([]);
  const [policySearch, setPolicySearch]       = useState("");
  const [searchResults, setSearchResults]     = useState<Policy[]>([]);
  const [searchLoading, setSearchLoading]     = useState(false);
  const [linkingId, setLinkingId]             = useState<number | null>(null);
  const [unlinkingId, setUnlinkingId]         = useState<number | null>(null);

  useEffect(() => { setCurrentUser(getStoredUser()); }, []);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) { setError(t("risk.detail.invalidId")); setLoading(false); return; }
    Promise.all([
      riskApi.get(id).then((r) => setRisk(r.data.data)),
      riskApi.listActions(id).then((r) => setActions(r.data.data ?? [])),
      riskApi.getLogs(id).then((r) => setHistory(r.data.data ?? [])),
      riskAttachmentsApi.list(id).then((r) => setAttachments(r.data.data ?? [])),
      policyApi.listForRisk(id).then((r) => setRelatedPolicies(r.data.data ?? [])),
    ])
      .catch(() => setError(t("risk.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [paramId]);

  // Debounced policy search
  useEffect(() => {
    if (!policySearch.trim()) { setSearchResults([]); return; }
    const t = setTimeout(() => {
      setSearchLoading(true);
      policyApi.list({ search: policySearch, per_page: 8 })
        .then((r) => {
          const linked = new Set(relatedPolicies.map((p) => p.id));
          setSearchResults((r.data.data ?? []).filter((p: Policy) => !linked.has(p.id)));
        })
        .finally(() => setSearchLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [policySearch, relatedPolicies]);

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
      const action = WORKFLOW_ACTIONS.includes(modal ?? "") ? modal! : "update";
      toast.success(t(`risk.detail.toast.${action}`));
      setModal(null);
      setModalData({});
      // Refresh history
      riskApi.getLogs(risk.id).then((r) => setHistory(r.data.data ?? []));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("risk.detail.actionFailed") : t("risk.detail.actionFailed");
      setModalError(msg);
      toast.error(t(`risk.detail.failed.${WORKFLOW_ACTIONS.includes(modal ?? "") ? modal : "update"}`), msg);
    } finally {
      setWorking(false);
    }
  }

  async function handleAddAction(e: React.FormEvent) {
    e.preventDefault();
    if (!risk || !actionForm.description.trim()) return;
    setSavingAction(true);
    try {
      await riskApi.applyMitigations(
        buildMitigationFormData({
          riskIds: [risk.id],
          description: actionForm.description,
          treatmentType: actionForm.treatment_type,
          dueDate: actionForm.due_date || undefined,
          file: actionForm.file,
          documentType: "risk_mitigation_plan",
        }),
      );
      const [acts, atts] = await Promise.all([
        riskApi.listActions(risk.id),
        riskAttachmentsApi.list(risk.id),
      ]);
      setActions(acts.data.data ?? []);
      setAttachments(atts.data.data ?? []);
      setActionForm(EMPTY_MITIGATION);
      setShowActionForm(false);
      toast.success(t("risk.detail.mitigationAdded"));
    } catch (err: unknown) {
      const message = apiErrorMessage(err, t("risk.mitigation.failed"));
      setError(message);
      toast.error(t("risk.detail.mitigationNotAdded"), message);
    } finally {
      setSavingAction(false);
    }
  }

  async function completeAction(action: RiskAction) {
    if (!risk) return;
    try {
      const res = await riskApi.completeAction(risk.id, action.id);
      setActions((prev) => prev.map((a) => a.id === action.id ? res.data.data : a));
      toast.success(t("risk.detail.actionCompleted"));
    } catch (err) {
      toast.error(t("risk.detail.actionNotCompleted"), apiErrorMessage(err, t("risk.common.tryAgain")));
    }
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-4 animate-pulse">
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
      <div className="w-full min-w-0">
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{error ?? t("risk.detail.notFound")}</div>
        <Link href="/risk" className="btn-secondary mt-4 inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> {t("common.back")}
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[risk.status] ?? STATUS_CONFIG.draft;
  const levelCfg  = LEVEL_CONFIG[risk.risk_level] ?? LEVEL_CONFIG.low;

  const WORKFLOW_STEPS = [
    { key: "draft",      label: t("risk.analytics.status.draft")      },
    { key: "submitted",  label: t("risk.analytics.status.submitted")  },
    { key: "reviewed",   label: t("risk.analytics.status.reviewed")   },
    { key: "approved",   label: t("risk.analytics.status.approved")   },
    { key: "monitoring", label: t("risk.analytics.status.monitoring") },
    { key: "escalated",  label: t("risk.analytics.status.escalated")  },
    { key: "closed",     label: t("risk.analytics.status.closed")     },
    { key: "archived",   label: t("risk.analytics.status.archived")   },
  ];
  const currentStepIdx = WORKFLOW_STEPS.findIndex((s) => s.key === risk.status);

  const EFFECTIVENESS_TILES = [
    { key: "none",     label: t("risk.detail.effectiveness.none"),     active: "bg-red-100 border-red-400 text-red-700"     },
    { key: "partial",  label: t("risk.detail.effectiveness.partial"),  active: "bg-yellow-100 border-yellow-400 text-yellow-700" },
    { key: "adequate", label: t("risk.detail.effectiveness.adequate"), active: "bg-blue-100 border-blue-400 text-blue-700"  },
    { key: "strong",   label: t("risk.detail.effectiveness.strong"),   active: "bg-green-100 border-green-400 text-green-700" },
  ];

  // Role-based action availability
  const canReview    = hasRole(currentUser, "HOD", "Director", "Governance Officer", "Internal Auditor", "System Admin", "super-admin");
  const canApprove   = hasRole(currentUser, "Director", "Secretary General", "System Admin", "super-admin");
  const canEscalate  = hasRole(currentUser, "HOD", "Director", "Governance Officer", "Secretary General", "System Admin", "super-admin");
  const canClose     = hasRole(currentUser, "Director", "Secretary General", "System Admin", "super-admin");
  const canArchive   = hasRole(currentUser, "Secretary General", "System Admin", "super-admin");
  const canReopen    = hasRole(currentUser, "Director", "Governance Officer", "Secretary General", "System Admin", "super-admin");
  const isOwner      = currentUser?.id === risk.submitted_by || currentUser?.id === risk.risk_owner_id;
  const workflowModalTitle = t(`risk.detail.modal.${WORKFLOW_ACTIONS.includes(modal ?? "") ? modal : "reopen"}`);
  const workflowModalIcon = modal === "submit" ? "send" : modal === "review" ? "rate_review" : modal === "approve" ? "check_circle" : modal === "escalate" ? "warning" : modal === "close" ? "lock" : modal === "archive" ? "archive" : "refresh";
  const workflowConfirmDisabled = working || (modal === "escalate" && !modalData.level) || (modal === "close" && !modalData.evidence?.trim());
  const closeWorkflowModal = () => {
    setModal(null);
    setModalError(null);
  };

  return (
    <RiskPageFrame>
      <ModulePageHeader
        title={risk.title}
        subtitle={risk.risk_code}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "risk.hub", href: "/risk" },
              { label: risk.risk_code },
            ]}
          />
        }
      />

      <WorkflowStatusBanner
        status={risk.status}
        currentStage={WORKFLOW_STEPS[currentStepIdx]?.label ?? null}
        currentHolder={(risk as { owner?: { name?: string }; owner_name?: string }).owner?.name
          ?? (risk as { owner_name?: string }).owner_name
          ?? null}
      />

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

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b border-neutral-200" role="tablist" aria-label={t("risk.detail.sections")}>
        {(["details", "documents", "policies"] as const).map((tab) => (
          <button
            key={tab}
            id={`risk-tab-${tab}`}
            role="tab"
            type="button"
            aria-selected={activeTab === tab}
            aria-controls={tab === "details" ? undefined : `risk-panel-${tab}`}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "documents"
              ? (attachments.length > 0 ? t("risk.policy.documentsCount", { count: attachments.length }) : t("risk.policy.documents"))
              : tab === "policies"
              ? (relatedPolicies.length > 0 ? t("risk.detail.tabPoliciesCount", { count: relatedPolicies.length }) : t("risk.detail.tabPolicies"))
              : t("risk.policy.details")}
          </button>
        ))}
      </div>

      {activeTab === "details" && <>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1 flex-1 min-w-0">
            <p className="text-lg font-semibold text-neutral-900 leading-snug">{risk.title}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs text-neutral-400">{risk.risk_code}</span>
              <span className="text-neutral-300">·</span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${levelCfg.cls}`}>
                {t("risk.detail.levelScore", { level: enumLabel(t, `risk.create.level.${risk.risk_level}`, risk.risk_level).toUpperCase(), score: risk.inherent_score })}
              </span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.cls}`}>
                <span className="material-symbols-outlined text-[11px]">{statusCfg.icon}</span>
                {t(statusCfg.label)}
              </span>
              {risk.status === "escalated" && risk.escalation_level !== "none" && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border text-orange-700 bg-orange-50 border-orange-200">
                  <span className="material-symbols-outlined text-[11px]">escalator_warning</span>
                  {enumLabel(t, `risk.common.escalation.${risk.escalation_level}`, titleCase(risk.escalation_level))}
                </span>
              )}
            </div>
          </div>

          {/* Workflow action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {risk.status === "draft" && isOwner && (
              <button onClick={() => setModal("submit")} className="btn-primary flex items-center gap-1.5 text-sm">
                <span className="material-symbols-outlined text-[16px]">send</span> {t("common.submit")}
              </button>
            )}
            {risk.status === "submitted" && canReview && (
              <button onClick={() => setModal("review")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">rate_review</span> {t("risk.detail.modal.review")}
              </button>
            )}
            {risk.status === "reviewed" && canApprove && (
              <button onClick={() => setModal("approve")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-green-600 text-white hover:bg-green-700 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">check_circle</span> {t("common.approve")}
              </button>
            )}
            {["submitted","reviewed","approved","monitoring"].includes(risk.status) && canEscalate && (
              <button onClick={() => setModal("escalate")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">warning</span> {t("risk.detail.escalate")}
              </button>
            )}
            {["approved","monitoring","escalated"].includes(risk.status) && canClose && (
              <button onClick={() => setModal("close")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-700 border border-neutral-200 hover:bg-neutral-200 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">lock</span> {t("risk.detail.close")}
              </button>
            )}
            {risk.status === "closed" && canArchive && (
              <button onClick={() => setModal("archive")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-neutral-200 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">archive</span> {t("risk.detail.archive")}
              </button>
            )}
            {["closed","archived"].includes(risk.status) && canReopen && (
              <button onClick={() => setModal("reopen")} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 font-semibold transition-colors">
                <span className="material-symbols-outlined text-[16px]">refresh</span> {t("risk.detail.reopen")}
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
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.create.description")}</h2>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{risk.description}</p>
          </div>

          {/* Risk info */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="info" color="text-indigo-600" bg="bg-indigo-50" />
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.riskDetails")}</h2>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
              {[
                { label: t("risk.create.category"),           value: enumLabel(t, `risk.create.category.${risk.category}`, titleCase(risk.category)) },
                { label: t("risk.common.riskOwner"),          value: risk.riskOwner?.name ?? "—"          },
                { label: t("risk.detail.actionOwner"),        value: risk.actionOwner?.name ?? "—"        },
                { label: t("risk.detail.submittedBy"),        value: risk.submitter?.name ?? "—"          },
                { label: t("risk.detail.submittedAt"),        value: risk.submitted_at ? fmt(risk.submitted_at) : "—" },
                { label: t("risk.detail.reviewFrequency"),    value: risk.review_frequency ? enumLabel(t, `risk.create.frequency.${risk.review_frequency}`, titleCase(risk.review_frequency)) : "—" },
                { label: t("risk.common.nextReview"),         value: risk.next_review_date ? fmt(risk.next_review_date) : "—" },
                { label: t("risk.detail.controlEffectiveness"), value: enumLabel(t, `risk.detail.effectiveness.${risk.control_effectiveness}`, titleCase(risk.control_effectiveness)) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-xs text-neutral-400 font-medium">{label}</p>
                  <p className="text-neutral-800 font-medium mt-0.5">{value}</p>
                </div>
              ))}
            </div>
            {risk.review_notes && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 font-medium mb-1">{t("risk.detail.reviewNotes")}</p>
                <p className="text-sm text-neutral-700">{risk.review_notes}</p>
              </div>
            )}
            {risk.closure_evidence && (
              <div className="mt-4 pt-4 border-t border-neutral-100">
                <p className="text-xs text-neutral-400 font-medium mb-1">{t("risk.detail.closureEvidence")}</p>
                <p className="text-sm text-neutral-700">{risk.closure_evidence}</p>
              </div>
            )}
          </div>

          {/* Mitigation Actions */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SectionIcon icon="task_alt" color="text-teal-600" bg="bg-teal-50" />
                <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.mitigationActions")}</h2>
                {actions.length > 0 && (
                  <span className="h-5 min-w-5 rounded-full bg-neutral-100 text-neutral-600 text-xs font-semibold flex items-center justify-center px-1.5">{actions.length}</span>
                )}
              </div>
              {!showActionForm && (
                <button type="button" onClick={() => setShowActionForm(true)} className="btn-secondary text-xs py-1 px-2 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add</span> {t("risk.detail.addAction")}
                </button>
              )}
            </div>

            {showActionForm && (
              <form onSubmit={handleAddAction} className="bg-neutral-50 rounded-xl border border-neutral-200 p-4 mb-4 space-y-3">
                <h3 className="text-xs font-semibold text-neutral-700">{t("risk.mitigation.hint")}</h3>
                <ApplyMitigationFields
                  idPrefix="risk-detail-mitigation"
                  value={actionForm}
                  onChange={setActionForm}
                  required
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setShowActionForm(false)} className="btn-secondary text-xs py-1.5">{t("common.cancel")}</button>
                  <button type="submit" disabled={savingAction} className="btn-primary text-xs py-1.5 flex items-center gap-1">
                    {savingAction && <span className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                    {t("risk.mitigation.apply")}
                  </button>
                </div>
              </form>
            )}

            {actions.length === 0 ? (
              <p className="text-sm text-neutral-400 py-3">{t("risk.detail.noActions")}</p>
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
                            <span className="text-xs text-neutral-400 capitalize">{enumLabel(t, `risk.mitigation.type.${action.treatment_type}`, action.treatment_type)}</span>
                            {action.due_date && (
                              <span className={`text-xs ${isOverdue ? "text-red-600 font-semibold" : "text-neutral-400"}`}>
                                {t("risk.detail.dueDate", { date: action.due_date })}
                              </span>
                            )}
                            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isComplete ? "text-green-700 bg-green-100" : isOverdue ? "text-red-700 bg-red-100" : "text-neutral-600 bg-neutral-100"}`}>
                              {enumLabel(t, `risk.detail.actionStatus.${action.status}`, titleCase(action.status))}
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
                            title={t("mande.report.markComplete")}
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
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.riskScoring")}</h2>
            </div>
            <div className="space-y-3">
              <ScoreMeter score={risk.inherent_score} label={t("risk.common.inherentScore")} />
              {risk.residual_score != null && (
                <ScoreMeter score={risk.residual_score} label={t("risk.common.residualScore")} />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-center">
                <p className="text-lg font-bold text-neutral-900">{risk.likelihood}</p>
                <p className="text-[10px] text-neutral-400">{t("reports.col.likelihood")}</p>
              </div>
              <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-3 py-2 text-center">
                <p className="text-lg font-bold text-neutral-900">{risk.impact}</p>
                <p className="text-[10px] text-neutral-400">{t("reports.col.impact")}</p>
              </div>
            </div>
            <div className={`mt-3 rounded-lg border px-3 py-2.5 text-center text-sm font-bold ${levelCfg.cls}`}>
              {t("risk.detail.levelRisk", { level: t(levelCfg.label) })}
            </div>
            {/* Control effectiveness read-only tiles */}
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 font-medium mb-2">{t("risk.detail.controlEffectiveness")}</p>
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
              <SectionIcon icon="history" color="text-primary" bg="bg-primary/10" />
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.history")}</h2>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-neutral-400">{t("decisions.detail.noHistory")}</p>
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
                            {changeTypeLabel(t, h.change_type)}
                            {h.from_status && h.to_status && (
                              <span className="text-neutral-400 font-normal"> · {enumLabel(t, `risk.analytics.status.${h.from_status}`, h.from_status)} → {enumLabel(t, `risk.analytics.status.${h.to_status}`, h.to_status)}</span>
                            )}
                          </p>
                          <p className="text-[10px] text-neutral-400 mt-0.5">
                            {h.actor?.name ?? t("risk.detail.system")} · {fmt(h.created_at)}
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
        {t("risk.detail.backToRegister")}
      </Link>

      </> /* end details tab */}

      {/* ── Documents Tab ── */}
      {activeTab === "documents" && (
        <div id="risk-panel-documents" role="tabpanel" aria-labelledby="risk-tab-documents" className="card p-6">
          <div className="flex items-center gap-2 mb-5">
            <SectionIcon icon="attach_file" color="text-blue-600" bg="bg-blue-50" />
            <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.riskDocuments")}</h2>
          </div>
          <RiskDocumentsPanel
            documents={attachments}
            loading={false}
            uploading={uploading}
            onUpload={async (file: File, type: RiskDocumentType) => {
              setUploading(true);
              try {
                const r = await riskAttachmentsApi.upload(risk.id, file, type);
                setAttachments((prev) => [r.data.data, ...prev]);
                toast.success(t("risk.policy.docUploaded"));
              } catch (err) {
                toast.error(t("risk.policy.docNotUploaded"), apiErrorMessage(err, t("risk.policy.docUploadFailed")));
                throw err;
              } finally { setUploading(false); }
            }}
            onDelete={async (id: number) => {
              try {
                await riskAttachmentsApi.delete(risk.id, id);
                setAttachments((prev) => prev.filter((a) => a.id !== id));
                toast.success(t("risk.policy.docDeleted"));
              } catch (err) {
                toast.error(t("risk.policy.docNotDeleted"), apiErrorMessage(err, t("risk.policy.docDeleteFailed")));
                throw err;
              }
            }}
            downloadUrl={(id: number) => riskAttachmentsApi.downloadUrl(risk.id, id)}
          />
        </div>
      )}

      {/* ── Policies Tab ── */}
      {activeTab === "policies" && (
        <div id="risk-panel-policies" role="tabpanel" aria-labelledby="risk-tab-policies" className="space-y-5">
          {/* Linked policies */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="policy" color="text-indigo-600" bg="bg-indigo-50" />
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.tabPolicies")}</h2>
            </div>
            {relatedPolicies.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">{t("risk.detail.noPolicies")}</p>
            ) : (
              <div className="space-y-2">
                {relatedPolicies.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-white transition-all">
                    <span className="material-symbols-outlined text-indigo-500 text-[20px]">policy</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{p.title}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        {p.owner_name && <span>{p.owner_name}</span>}
                        {p.renewal_date && <span className="ml-2">{t("risk.policy.renewal", { date: new Date(p.renewal_date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) })}</span>}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        setUnlinkingId(p.id);
                        try {
                          await policyApi.detachFromRisk(p.id, risk.id);
                          setRelatedPolicies((prev) => prev.filter((x) => x.id !== p.id));
                          toast.success(t("risk.detail.policyUnlinked"));
                        } catch (err) {
                          toast.error(t("risk.detail.policyNotUnlinked"), apiErrorMessage(err, t("risk.common.tryAgain")));
                        } finally { setUnlinkingId(null); }
                      }}
                      disabled={unlinkingId === p.id}
                      className="text-xs text-red-500 hover:text-red-700 px-2 py-1 rounded border border-red-100 hover:border-red-300 disabled:opacity-50 flex-shrink-0"
                    >
                      {unlinkingId === p.id ? "…" : t("risk.common.unlink")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & link panel */}
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <SectionIcon icon="search" color="text-neutral-600" bg="bg-neutral-100" />
              <h2 className="text-sm font-semibold text-neutral-800">{t("risk.detail.linkPolicy")}</h2>
            </div>
            <input
              type="text"
              value={policySearch}
              onChange={(e) => setPolicySearch(e.target.value)}
              placeholder={t("risk.detail.searchPolicies")}
              className="form-input w-full mb-3"
            />
            {searchLoading && <p className="text-xs text-neutral-400 mb-2">{t("risk.common.searching")}</p>}
            {searchResults.length > 0 && (
              <div className="space-y-2">
                {searchResults.map((p) => (
                  <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-white hover:border-neutral-200 transition-all">
                    <span className="material-symbols-outlined text-neutral-400 text-[18px]">policy</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{p.title}</p>
                      {p.owner_name && <p className="text-xs text-neutral-400">{p.owner_name}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        setLinkingId(p.id);
                        try {
                          await policyApi.attachToRisk(p.id, risk.id);
                          setRelatedPolicies((prev) => [...prev, p]);
                          setPolicySearch("");
                          setSearchResults([]);
                          toast.success(t("risk.detail.policyLinked"));
                        } catch (err) {
                          toast.error(t("risk.detail.policyNotLinked"), apiErrorMessage(err, t("risk.common.tryAgain")));
                        } finally { setLinkingId(null); }
                      }}
                      disabled={linkingId === p.id}
                      className="btn-primary text-xs px-3 py-1.5 disabled:opacity-60 flex-shrink-0"
                    >
                      {linkingId === p.id ? "…" : t("risk.common.link")}
                    </button>
                  </div>
                ))}
              </div>
            )}
            {policySearch && !searchLoading && searchResults.length === 0 && (
              <p className="text-xs text-neutral-400 italic">{t("risk.policies.empty")} <Link href="/risk/policies" className="btn-secondary text-xs py-0.5 px-2 inline-flex ml-1">{t("risk.detail.manageLibrary")}</Link></p>
            )}
          </div>
        </div>
      )}

      {/* ── Workflow Modal ── */}
      {modal && (
        <Modal
          open={Boolean(modal)}
          onClose={closeWorkflowModal}
          size="md"
          className="max-w-md dark:shadow-black/40"
          bodyClassName="space-y-4"
          title={
            <span className="flex items-center gap-3">
              <span aria-hidden="true" className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 dark:bg-primary/20">
                <span className="material-symbols-outlined text-[20px] text-primary dark:text-primary-300">
                  {workflowModalIcon}
                </span>
              </span>
              <span>{workflowModalTitle}</span>
            </span>
          }
          description={risk.risk_code}
          footer={
            <>
              <button className="btn-secondary flex-1" onClick={closeWorkflowModal} disabled={working}>{t("common.cancel")}</button>
              <button
                className="btn-primary flex-1 flex items-center justify-center gap-1.5"
                onClick={doWorkflowAction}
                disabled={workflowConfirmDisabled}
              >
                {working ? <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : t("common.confirm")}
              </button>
            </>
          }
        >
            {modalError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">{modalError}</div>
            )}

            {modal === "escalate" && (
              <>
                <div>
                  <label htmlFor="risk-escalate-level" className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t("risk.detail.escalationLevel")} <span className="text-red-500 dark:text-red-400">*</span></label>
                  <select id="risk-escalate-level" className="form-input w-full" value={modalData.level ?? ""} onChange={(e) => setModalData((p) => ({ ...p, level: e.target.value }))}>
                    <option value="">{t("risk.create.frequencyPlaceholder")}</option>
                    <option value="departmental">{t("risk.common.escalation.departmental")}</option>
                    <option value="directorate">{t("risk.common.escalation.directorate")}</option>
                    <option value="sg">{t("risk.common.escalation.sg")}</option>
                    <option value="committee">{t("risk.common.escalation.committee")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="risk-escalate-notes" className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t("risk.common.notes")}</label>
                  <textarea id="risk-escalate-notes" className="form-input w-full h-20 resize-none" value={modalData.notes ?? ""} onChange={(e) => setModalData((p) => ({ ...p, notes: e.target.value }))} placeholder={t("risk.detail.escalationReason")} />
                </div>
              </>
            )}

            {modal === "approve" && (
              <div>
                <label htmlFor="risk-approve-notes" className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t("risk.detail.reviewNotes")}</label>
                <textarea id="risk-approve-notes" className="form-input w-full h-20 resize-none" value={modalData.notes ?? ""} onChange={(e) => setModalData((p) => ({ ...p, notes: e.target.value }))} placeholder={t("risk.detail.approveNotesPlaceholder")} />
              </div>
            )}

            {modal === "close" && (
              <div>
                <label htmlFor="risk-close-evidence" className="mb-1.5 block text-xs font-semibold text-neutral-700 dark:text-neutral-200">{t("risk.detail.closureEvidence")} <span className="text-red-500 dark:text-red-400">*</span></label>
                <textarea id="risk-close-evidence" className="form-input w-full h-24 resize-none" value={modalData.evidence ?? ""} onChange={(e) => setModalData((p) => ({ ...p, evidence: e.target.value }))} placeholder={t("risk.detail.closeEvidencePlaceholder")} />
              </div>
            )}

            {(modal === "submit" || modal === "review" || modal === "archive" || modal === "reopen") && (
              <p className="text-sm text-neutral-600 dark:text-neutral-300">
                {modal === "submit"  && t("risk.detail.confirm.submit")}
                {modal === "review"  && t("risk.detail.confirm.review")}
                {modal === "archive" && t("risk.detail.confirm.archive")}
                {modal === "reopen"  && t("risk.detail.confirm.reopen")}
              </p>
            )}
        </Modal>
      )}
    </RiskPageFrame>
  );
}
