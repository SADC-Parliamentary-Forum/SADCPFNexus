"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { procurementApi, quotesApi, budgetReservationsApi, procurementRequestAttachmentsApi, PROCUREMENT_REQUEST_DOC_TYPES, type ProcurementRequest, type ProcurementAttachment, type ProcurementQuote } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import BudgetLinePicker from "@/components/budget/BudgetLinePicker";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { useFormatDate } from "@/lib/useFormatDate";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { ReturnModal } from "@/components/workflow/ReturnModal";
import { WorkflowStatusBanner } from "@/components/workflow/WorkflowStatusBanner";
import { PrintButton } from "@/components/ui/PrintButton";
import axios from "axios";
import { useToast } from "@/components/ui/Toast";
import { ProcurementPageHeader } from "@/components/procurement/ProcurementPageHeader";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function canReserveBudget(): boolean {
  const u = getStoredUser();
  if (!u) return false;
  return isSystemAdmin(u) || hasPermission(u, ["finance.approve", "finance.admin", "procurement.admin"]);
}

function canAward(user: { roles?: string[] } | null): boolean {
  const allowed = ["Procurement Officer", "Secretary General", "System Admin", "super-admin"];
  return (user?.roles ?? []).some((r) => allowed.includes(r));
}

function isHOD(user: { roles?: string[] } | null): boolean {
  return (user?.roles ?? []).some((r) => ["HOD", "System Admin", "super-admin"].includes(r));
}

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  approved:                { label: "procurement.detail.status.approved",               cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"       },
  submitted:               { label: "procurement.detail.status.submitted",            cls: "text-amber-700 bg-amber-50 border-amber-200",        icon: "pending"            },
  hod_approved:            { label: "procurement.detail.status.hodApproved",           cls: "text-teal-700 bg-teal-50 border-teal-200",           icon: "supervisor_account" },
  hod_rejected:            { label: "procurement.detail.status.hodRejected",           cls: "text-red-700 bg-red-50 border-red-200",              icon: "person_off"         },
  budget_reserved:         { label: "procurement.detail.status.budgetReserved",        cls: "text-indigo-700 bg-indigo-50 border-indigo-200",     icon: "savings"            },
  rfq_issued:              { label: "procurement.detail.status.rfqIssued",             cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "send"               },
  evaluated:               { label: "procurement.detail.status.evaluated",              cls: "text-teal-700 bg-teal-50 border-teal-200",           icon: "compare"            },
  rejected:                { label: "procurement.detail.status.rejected",               cls: "text-red-700 bg-red-50 border-red-200",              icon: "cancel"             },
  draft:                   { label: "procurement.detail.status.draft",                  cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"          },
  awarded:                 { label: "procurement.detail.status.awarded",                cls: "text-blue-700 bg-blue-50 border-blue-200",           icon: "emoji_events"       },
  po_issued:               { label: "procurement.detail.status.poIssued",              cls: "text-green-700 bg-green-50 border-green-200",        icon: "receipt_long"       },
  completed:               { label: "procurement.detail.status.completed",              cls: "text-green-700 bg-green-50 border-green-200",        icon: "check_circle"       },
  returned_for_correction: { label: "procurement.detail.status.returned", cls: "text-amber-700 bg-amber-50 border-amber-200",       icon: "undo"               },
  withdrawn:               { label: "procurement.detail.status.withdrawn",              cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "block"              },
};

const categoryConfig: Record<string, { icon: string; color: string; bg: string }> = {
  goods:    { icon: "inventory_2",    color: "text-primary",  bg: "bg-primary/10"  },
  services: { icon: "handyman",       color: "text-teal-600", bg: "bg-teal-50" },
  works:    { icon: "construction",   color: "text-orange-600", bg: "bg-orange-50" },
};

function SectionIcon({ icon, color, bg }: { icon: string; color: string; bg: string }) {
  return (
    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${bg} flex-shrink-0`}>
      <span className={`material-symbols-outlined text-[18px] ${color}`}>{icon}</span>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3 animate-pulse">
      <div className="h-3 w-24 bg-neutral-100 rounded" />
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="h-4 w-36 bg-neutral-100 rounded" />
    </div>
  );
}

export default function ProcurementDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { t } = useI18n();
  const { success, error: showErrorToast, info } = useToast();
  const { id: paramId } = use(params);
  const { fmt } = useFormatDate();
  const [request, setRequest]     = useState<ProcurementRequest | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<{ roles?: string[] } | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "documents">("details");
  const [attachments, setAttachments] = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading] = useState(false);

  // Award modal state
  const [showAward, setShowAward]       = useState(false);
  const [awardQuoteId, setAwardQuoteId] = useState<number | "">("");
  const [awardNotes, setAwardNotes]     = useState("");
  const [awardCoiDeclared, setAwardCoiDeclared] = useState(false);
  const [awardCoiConflict, setAwardCoiConflict] = useState(false);
  const [awardCoiNotes, setAwardCoiNotes] = useState("");
  const [awarding, setAwarding]         = useState(false);
  const [awardError, setAwardError]     = useState<string | null>(null);

  const [budgetLineId, setBudgetLineId] = useState<number | null>(null);
  const [reservedAmountInput, setReservedAmountInput] = useState("");
  const [reserveNotes, setReserveNotes] = useState("");
  const [reserving, setReserving] = useState(false);
  const [reserveError, setReserveError] = useState<string | null>(null);

  // Add Quote form state
  const [showAddQuote, setShowAddQuote]   = useState(false);
  const [quoteVendorName, setQuoteVendorName] = useState("");
  const [quoteAmount, setQuoteAmount]     = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("NAD");
  const [quoteNotes, setQuoteNotes]       = useState("");
  const [quoteDate, setQuoteDate]         = useState("");
  const [addingQuote, setAddingQuote]     = useState(false);
  const [quoteError, setQuoteError]       = useState<string | null>(null);

  // HOD action state
  const [hodAction, setHodAction]         = useState<"approve" | "reject" | null>(null);
  const [hodRejReason, setHodRejReason]   = useState("");
  const [hodWorking, setHodWorking]       = useState(false);
  const [hodError, setHodError]           = useState<string | null>(null);

  // Workflow action state
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason]       = useState("");
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnLoading, setReturnLoading]     = useState(false);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => { setCurrentUser(getStoredUser()); }, []);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) {
      setError(t("procurement.detail.invalidId"));
      setLoading(false);
      return;
    }
    Promise.all([
      procurementApi.get(id).then((res) => setRequest(res.data)),
      procurementRequestAttachmentsApi.list(id).then((r) => setAttachments(r.data.data ?? [])).catch(() => {}),
    ])
      .catch(() => setError(t("procurement.detail.loadFailed")))
      .finally(() => setLoading(false));
  }, [paramId]);

  async function handleAddQuote() {
    if (!request || !quoteVendorName || !quoteAmount) return;
    setAddingQuote(true);
    setQuoteError(null);
    try {
      const res = await quotesApi.create(request.id, {
        vendor_name: quoteVendorName,
        quoted_amount: parseFloat(quoteAmount),
        currency: quoteCurrency,
        notes: quoteNotes || undefined,
        quote_date: quoteDate || undefined,
      });
      // Append new quote to request.quotes
      setRequest((prev) => prev ? { ...prev, quotes: [...(prev.quotes ?? []), res.data.data] } : prev);
      setShowAddQuote(false);
      setQuoteVendorName("");
      setQuoteAmount("");
      setQuoteNotes("");
      setQuoteDate("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("procurement.detail.addQuoteFailed");
      setQuoteError(msg);
    } finally {
      setAddingQuote(false);
    }
  }

  async function handleAward() {
    if (!request || !awardQuoteId || !awardCoiDeclared) return;
    setAwarding(true);
    setAwardError(null);
    try {
      const res = await procurementApi.award(request.id, Number(awardQuoteId), {
        award_notes: awardNotes,
        coi_declared: awardCoiDeclared,
        coi_has_conflict: awardCoiConflict,
        coi_notes: awardCoiNotes || undefined,
      });
      setRequest(res.data.data);
      setShowAward(false);
      setAwardQuoteId("");
      setAwardNotes("");
      setAwardCoiDeclared(false);
      setAwardCoiConflict(false);
      setAwardCoiNotes("");
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("procurement.detail.awardFailed");
      setAwardError(msg);
    } finally {
      setAwarding(false);
    }
  }

  async function handleReserveBudget() {
    if (!request || !budgetLineId || !reservedAmountInput) return;
    setReserving(true);
    setReserveError(null);
    try {
      await budgetReservationsApi.reserve(request.id, {
        budget_line_id: budgetLineId,
        reserved_amount: parseFloat(reservedAmountInput),
        notes: reserveNotes.trim() || undefined,
      });
      const refreshed = await procurementApi.get(request.id);
      setRequest(refreshed.data);
      success(t("procurement.detail.budgetReserved"));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? e.response?.data?.message
          ?? e.response?.data?.errors?.budget_line_id?.[0]
          ?? e.response?.data?.errors?.amount?.[0]
          ?? t("procurement.detail.reserveFailed")
        : t("procurement.detail.reserveFailed");
      setReserveError(msg);
    } finally {
      setReserving(false);
    }
  }

  async function handleHodAction() {
    if (!request) return;
    setHodWorking(true);
    setHodError(null);
    try {
      const res = hodAction === "approve"
        ? await procurementApi.hodApprove(request.id)
        : await procurementApi.hodReject(request.id, hodRejReason);
      setRequest(res.data.data);
      setHodAction(null);
      setHodRejReason("");
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.actionFailed") : t("procurement.detail.actionFailed");
      setHodError(msg);
    } finally {
      setHodWorking(false);
    }
  }

  const refreshRequest = async () => {
    const id = Number(paramId);
    const res = await procurementApi.get(id);
    setRequest(res.data);
  };


  async function handleWorkflowApprove() {
    if (!request) return;
    setWorkflowLoading(true);
    try {
      const res = await procurementApi.approve(request.id);
      const notified: string[] = (res.data as any).notified_approvers ?? [];
      await refreshRequest();
      if (notified.length > 0) {
        success(t("procurement.detail.approvedNotified", { names: notified.join(", ") }));
      } else {
        success(t("procurement.detail.fullyApproved"));
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.approveFailed") : t("procurement.detail.approveFailed");
      setError(msg);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleWorkflowReject() {
    if (!request || !rejectReason.trim()) return;
    setWorkflowLoading(true);
    try {
      await procurementApi.reject(request.id, rejectReason.trim());
      await refreshRequest();
      setShowRejectModal(false);
      setRejectReason("");
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.rejectFailed") : t("procurement.detail.rejectFailed");
      setError(msg);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleReturn(comment: string) {
    if (!request) return;
    setReturnLoading(true);
    try {
      await procurementApi.returnForCorrection(request.id, comment);
      await refreshRequest();
      setShowReturnModal(false);
      success(t("procurement.detail.returnedMsg"));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.returnFailed") : t("procurement.detail.returnFailed");
      setError(msg);
    } finally {
      setReturnLoading(false);
    }
  }

  async function handleWithdraw() {
    if (!request) return;
    if (!(await confirm({ title: t("procurement.detail.withdrawTitle"), message: t("procurement.detail.withdrawMessage"), variant: "danger" }))) return;
    setWorkflowLoading(true);
    try {
      await procurementApi.withdraw(request.id);
      await refreshRequest();
      success(t("procurement.detail.withdrawn"));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.withdrawFailed") : t("procurement.detail.withdrawFailed");
      setError(msg);
    } finally {
      setWorkflowLoading(false);
    }
  }

  async function handleResubmit() {
    if (!request) return;
    if (!(await confirm({ title: t("procurement.detail.resubmitTitle"), message: t("procurement.detail.resubmitMessage"), variant: "primary" }))) return;
    setWorkflowLoading(true);
    try {
      await procurementApi.resubmit(request.id);
      await refreshRequest();
      success(t("procurement.detail.resubmitted"));
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e) ? e.response?.data?.message ?? t("procurement.detail.resubmitFailed") : t("procurement.detail.resubmitFailed");
      setError(msg);
    } finally {
      setWorkflowLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="w-full min-w-0 space-y-6">
        <div className="h-4 w-48 bg-neutral-100 rounded animate-pulse" />
        <div className="h-7 w-64 bg-neutral-100 rounded animate-pulse" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="w-full min-w-0 space-y-4">
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-red-500 text-[20px] flex-shrink-0 mt-0.5">error_outline</span>
          <div>
            <p className="text-sm font-semibold text-red-700">{t("procurement.detail.errorLoading")}</p>
            <p className="text-sm text-red-600 mt-0.5">{error ?? t("procurement.detail.notFound")}</p>
          </div>
        </div>
        <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          {t("procurement.detail.backToProcurement")}
        </Link>
      </div>
    );
  }

  const s = statusConfig[request.status] ?? statusConfig.draft;
  const catInfo = categoryConfig[request.category] ?? { icon: "shopping_cart", color: "text-neutral-600", bg: "bg-neutral-100" };
  const categoryLabel = categoryConfig[request.category]
    ? t(`procurement.category.${request.category}`)
    : request.category.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const documentTypes = PROCUREMENT_REQUEST_DOC_TYPES.map((dt) => ({ ...dt, label: t(`procurement.detail.docType.${dt.value}`) }));
  const items = request.items ?? [];
  const quotes = request.quotes ?? [];
  const totalItems = items.reduce((sum, i) => sum + (i.total_price ?? 0), 0);
  const currency = request.currency ?? "USD";
  const approvalRequest = (request as any).approval_request;
  const currentStep = approvalRequest?.workflow?.steps?.[approvalRequest?.current_step_index];
  const canReturn = approvalRequest?.status === "pending" && currentStep?.allow_return;
  const isReturnedForCorrection = request.status === "returned_for_correction";
  const hasWorkflowApprovalPending = approvalRequest?.status === "pending" && request.status === "submitted";

  return (
    <div className="w-full min-w-0 space-y-5">

      {/* Toast */}

      <WorkflowStatusBanner
        status={request.status}
        currentStage={currentStep?.name ?? currentStep?.role_name ?? null}
        currentHolder={typeof approvalRequest?.current_approver_name === 'string' ? approvalRequest.current_approver_name : null}
      />

      <div className="flex justify-end no-print"><PrintButton className="text-xs" /></div>

      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "documents"
              ? (attachments.length > 0 ? t("procurement.detail.tabDocumentsCount", { count: attachments.length }) : t("procurement.detail.tabDocuments"))
              : t("procurement.detail.tabDetails")}
          </button>
        ))}
      </div>

      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">{t("procurement.detail.documentsTitle")}</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={documentTypes}
            defaultType="rfq_document"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try {
                const r = await procurementRequestAttachmentsApi.upload(request!.id, file, type);
                setAttachments((prev) => [r.data.data, ...prev]);
              } finally { setUploading(false); }
            }}
            onDelete={async (id) => {
              await procurementRequestAttachmentsApi.delete(request!.id, id);
              setAttachments((prev) => prev.filter((a) => a.id !== id));
            }}
            downloadUrl={(id) => procurementRequestAttachmentsApi.downloadUrl(request!.id, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>

      <ProcurementPageHeader
        title={request.title}
        crumbs={[
          { label: "nav.procurement", href: "/procurement" },
          { label: request.reference_number },
        ]}
      />
      <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${catInfo.color} bg-${catInfo.bg} border-neutral-200`}>
                <span className={`material-symbols-outlined text-[12px] ${catInfo.color}`}>{catInfo.icon}</span>
                {categoryLabel}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                <span className="material-symbols-outlined text-[12px]">gavel</span>
                {request.procurement_method ?? "—"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {t(s.label)}
            </span>
            {request.status === "approved" && (
              <Link
                href={`/procurement/${request.id}/certificate`}
                className="inline-flex items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
                {t("procurement.detail.certificate")}
              </Link>
            )}
            {/* HOD action buttons — visible when submitted and current user is HOD */}
            {request.status === "submitted" && isHOD(currentUser) && (
              <>
                <button
                  onClick={() => { setHodAction("approve"); setHodError(null); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">supervisor_account</span>
                  {t("procurement.detail.hodApprove")}
                </button>
                <button
                  onClick={() => { setHodAction("reject"); setHodError(null); }}
                  className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold transition-colors"
                >
                  <span className="material-symbols-outlined text-[14px]">person_off</span>
                  {t("procurement.detail.hodReject")}
                </button>
              </>
            )}
            {request.status === "approved" && canAward(currentUser) && quotes.length > 0 && (
              <button
                onClick={() => setShowAward(true)}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                {t("procurement.detail.awardContract")}
              </button>
            )}
            {hasWorkflowApprovalPending && (
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={workflowLoading}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-semibold transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">cancel</span>
                {t("procurement.detail.reject")}
              </button>
            )}
            {request.status === "submitted" && approvalRequest?.status === "pending" && (
              <button
                onClick={handleWithdraw}
                disabled={workflowLoading}
                className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">block</span>
                {t("procurement.detail.withdraw")}
              </button>
            )}
            {isReturnedForCorrection && (
              <button
                onClick={handleResubmit}
                disabled={workflowLoading}
                className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                {t("procurement.detail.resubmit")}
              </button>
            )}
          </div>
        </div>

      {/* Workflow Approval Decision */}
      {hasWorkflowApprovalPending && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="gavel" color="text-amber-600" bg="bg-amber-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.approvalDecision")}</h3>
          </div>
          <p className="text-sm text-neutral-500 mb-4">{t("procurement.detail.approvalHint")}</p>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={handleWorkflowApprove}
              disabled={workflowLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">check_circle</span>
              {workflowLoading ? t("procurement.detail.processing") : t("procurement.detail.approveRequest")}
            </button>
            {canReturn && (
              <button
                onClick={() => setShowReturnModal(true)}
                disabled={workflowLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">undo</span>
                {t("procurement.detail.return")}
              </button>
            )}
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={workflowLoading}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              {t("procurement.detail.reject")}
            </button>
          </div>
        </div>
      )}

      {/* Approval Timeline */}
      <ApprovalTimeline request={approvalRequest} />

      {/* Finance budget reservation */}
      {request.status === "hod_approved" && canReserveBudget() && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-3">
            <SectionIcon icon="savings" color="text-indigo-600" bg="bg-indigo-50" />
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.budgetConfirmation")}</h3>
              <p className="text-xs text-neutral-400 mt-0.5">{t("procurement.detail.budgetHint")}</p>
            </div>
          </div>
          {reserveError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">{reserveError}</div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <BudgetLinePicker
              value={budgetLineId}
              amount={reservedAmountInput ? parseFloat(reservedAmountInput) : Number(request.estimated_value ?? 0)}
              required
              onChange={(id) => setBudgetLineId(id)}
            />
            <div>
              <label htmlFor="procurement-reserved-amount" className="block text-xs font-semibold text-neutral-700 mb-1">{t("procurement.detail.reservedAmount")}</label>
              <input id="procurement-reserved-amount"
                type="number"
                min={0}
                step="0.01"
                className="form-input w-full"
                value={reservedAmountInput || String(request.estimated_value ?? "")}
                onChange={(e) => setReservedAmountInput(e.target.value)}
              />
            </div>
          </div>
          <textarea
            className="form-input w-full h-16 resize-none"
            placeholder={t("procurement.detail.financeNotes")}
            value={reserveNotes}
            onChange={(e) => setReserveNotes(e.target.value)}
          />
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-50"
            disabled={reserving}
            onClick={handleReserveBudget}
          >
            {reserving ? t("procurement.detail.reserving") : t("procurement.detail.confirmReservation")}
          </button>
        </div>
      )}

      {/* Requested By */}
      {request.requester && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="badge" color="text-primary" bg="bg-primary/10" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.requestedBy")}</h3>
            {request.submitted_at && (
              <span className="ml-auto text-xs text-neutral-400">
                {fmt(request.submitted_at)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-sm font-bold text-primary">
                {String(request.requester.name ?? "").split(" ").map((n) => n[0]).join("").slice(0, 2) || "—"}
              </span>
            </div>
            <div>
              <p className="text-sm font-semibold text-neutral-900">{request.requester.name}</p>
              <p className="text-xs text-neutral-400">
                {[request.requester.job_title, (request.requester as { employee_number?: string }).employee_number].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Requisition Details */}
      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <SectionIcon icon="shopping_cart" color="text-primary" bg="bg-primary/10" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.requisitionDetails")}</h3>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">category</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.category")}</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{categoryLabel}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">gavel</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.procurementMethod")}</p>
            </div>
            <p className="font-medium text-neutral-900 capitalize">{request.procurement_method ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">account_tree</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.budgetLine")}</p>
            </div>
            <p className="font-mono text-xs text-neutral-900">{request.budget_line ?? "—"}</p>
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">calendar_today</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.requiredBy")}</p>
            </div>
            <p className="font-medium text-neutral-900">{request.required_by_date ?? "—"}</p>
          </div>
        </div>
        {request.description && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">description</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.description")}</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.description}</p>
          </div>
        )}
        {request.justification && (
          <div className="mt-3 pt-3 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="material-symbols-outlined text-[14px] text-neutral-300">chat_bubble</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{t("procurement.detail.justification")}</p>
            </div>
            <p className="text-sm text-neutral-700 leading-relaxed">{request.justification}</p>
          </div>
        )}
      </div>

      {/* Line Items */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-3">
            <SectionIcon icon="list_alt" color="text-neutral-600" bg="bg-neutral-100" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.lineItems")}</h3>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-neutral-400 uppercase tracking-wide">{t("procurement.detail.total")}</span>
            <span className="text-sm font-bold text-primary">{currency} {totalItems.toLocaleString()}</span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("procurement.detail.description")}</th>
              <th className="text-center">{t("procurement.detail.qty")}</th>
              <th className="text-right">{t("procurement.detail.unitPrice")}</th>
              <th className="text-right">{t("procurement.detail.total")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <TableEmpty colSpan={4} title={t("procurement.detail.noLineItems")} />
            ) : items.map((item) => (
              <tr key={item.id}>
                <td>
                  <p className="font-medium text-neutral-900">{item.description}</p>
                  {item.unit && <p className="text-xs text-neutral-400">{item.unit}</p>}
                </td>
                <td className="text-center font-medium text-neutral-700">{item.quantity}</td>
                <td className="text-right text-neutral-600">{currency} {(item.estimated_unit_price ?? 0).toLocaleString()}</td>
                <td className="text-right font-bold text-neutral-900">{currency} {(item.total_price ?? 0).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Vendor Quotes */}
      {(quotes.length > 0 || request.rfq_issued_at) && (
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <SectionIcon icon="storefront" color="text-teal-600" bg="bg-teal-50" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">{t("procurement.detail.vendorQuotes")}</h3>
            <span className="ml-auto text-xs text-neutral-400">{t(quotes.length === 1 ? "procurement.detail.quoteCountOne" : "procurement.detail.quoteCountMany", { count: quotes.length })}</span>
            {request.rfq_issued_at && request.status !== "awarded" && canAward(currentUser) && (
              <button
                type="button"
                onClick={() => setShowAddQuote((v) => !v)}
                className="btn-secondary text-xs flex items-center gap-1 py-1 px-2.5"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                {t("procurement.detail.addQuote")}
              </button>
            )}
          </div>

          {/* Add Quote Form */}
          {showAddQuote && (
            <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50/50 p-4 space-y-3">
              <p className="text-xs font-semibold text-teal-700">{t("procurement.detail.newVendorQuote")}</p>
              {quoteError && (
                <p className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">{quoteError}</p>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="procurement-quote-vendor-name" className="mb-1 block text-xs font-medium text-neutral-600">{t("procurement.detail.vendorName")}</label>
                  <input id="procurement-quote-vendor-name"
                    type="text"
                    className="form-input text-sm"
                    placeholder={t("procurement.detail.vendorNamePlaceholder")}
                    value={quoteVendorName}
                    onChange={(e) => setQuoteVendorName(e.target.value)}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-24 flex-shrink-0">
                    <label htmlFor="procurement-detail-currency" className="mb-1 block text-xs font-medium text-neutral-600">{t("procurement.detail.currency")}</label>
                    <select id="procurement-detail-currency" className="form-input text-sm" value={quoteCurrency} onChange={(e) => setQuoteCurrency(e.target.value)}>
                      {["NAD", "USD", "ZAR", "BWP", "ZMW", "MWK", "TZS", "EUR"].map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label htmlFor="procurement-detail-amount" className="mb-1 block text-xs font-medium text-neutral-600">{t("procurement.detail.amount")}</label>
                    <input id="procurement-detail-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input text-sm"
                      placeholder="0.00"
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="procurement-detail-quote-date" className="mb-1 block text-xs font-medium text-neutral-600">{t("procurement.detail.quoteDate")}</label>
                  <input id="procurement-detail-quote-date"
                    type="date"
                    className="form-input text-sm"
                    value={quoteDate}
                    onChange={(e) => setQuoteDate(e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor="procurement-detail-notes" className="mb-1 block text-xs font-medium text-neutral-600">{t("procurement.detail.notes")}</label>
                  <input id="procurement-detail-notes"
                    type="text"
                    className="form-input text-sm"
                    placeholder={t("procurement.detail.optionalNotes")}
                    value={quoteNotes}
                    onChange={(e) => setQuoteNotes(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddQuote}
                  disabled={addingQuote || !quoteVendorName || !quoteAmount}
                  className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-60"
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {addingQuote ? "hourglass_top" : "save"}
                  </span>
                  {addingQuote ? t("procurement.detail.saving") : t("procurement.detail.saveQuote")}
                </button>
                <button type="button" onClick={() => { setShowAddQuote(false); setQuoteError(null); }} className="btn-secondary text-xs py-1.5 px-3">
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}

          {quotes.length === 0 && !showAddQuote && (
            <p className="text-xs text-neutral-400 text-center py-3">
              {t("procurement.detail.noQuotes")}
            </p>
          )}
          <div className="space-y-2.5">
            {[...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)).map((q, i) => (
              <div key={q.id} className={`rounded-xl border p-4 ${q.is_recommended ? "border-primary/30 bg-primary/5" : "border-neutral-100 bg-neutral-50"}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 ${q.is_recommended ? "bg-primary/10" : "bg-white border border-neutral-200"}`}>
                      <span className={`material-symbols-outlined text-[18px] ${q.is_recommended ? "text-primary" : "text-neutral-400"}`}>storefront</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <p className="text-sm font-semibold text-neutral-900">{q.vendor_name}</p>
                        {q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">star</span>
                            {t("procurement.detail.recommended")}
                          </span>
                        )}
                        {i === 0 && !q.is_recommended && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-green-700 bg-green-50 px-1.5 py-0.5 rounded-full">
                            <span className="material-symbols-outlined text-[11px]">trending_down</span>
                            {t("procurement.detail.lowest")}
                          </span>
                        )}
                      </div>
                      {q.notes && <p className="text-xs text-neutral-500">{q.notes}</p>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 uppercase tracking-wide">{t("procurement.detail.quote")}</p>
                    <p className="text-base font-bold text-neutral-900">{q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Awarded banner */}
      {request.status === "awarded" && request.awarded_quote_id && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 space-y-3">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-500 text-[22px] flex-shrink-0 mt-0.5">emoji_events</span>
            <div>
              <p className="text-sm font-semibold text-blue-800">{t("procurement.detail.contractAwarded")}</p>
              <p className="text-xs text-blue-600 mt-0.5">
                {(() => {
                  const [before, after = ""] = t("procurement.detail.awardedTo").split("{vendor}");
                  return <>{before}<strong>{quotes.find(q => q.id === request.awarded_quote_id)?.vendor_name ?? t("procurement.detail.vendorFallback")}</strong>{after}</>;
                })()}
                {request.award_notes && ` — ${request.award_notes}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(request.converted_to_po || request.po_link) && request.po_link && (
              <Link
                href={`/procurement/purchase-orders/${request.po_link.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">receipt_long</span>
                {t(request.converted_to_po ? "procurement.detail.convertedToPo" : "procurement.detail.purchaseOrderRef", { ref: request.po_link.display_reference })}
              </Link>
            )}
            <Link
              href={`/procurement/purchase-orders?request=${request.id}`}
              className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">receipt_long</span>
              {t("procurement.detail.createPo")}
            </Link>
            {request.contract_id ? (
              <Link
                href={`/contracts/${request.contract_id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-green-700 text-white hover:bg-green-800 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">description</span>
                {t("procurement.detail.viewContract", { ref: request.contract?.reference_number ?? "" })}
              </Link>
            ) : (
              <Link
                href={`/procurement/contracts?request=${request.id}`}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-white border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">description</span>
                {t("procurement.detail.createContract")}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Back link */}
      <Link href="/procurement" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("procurement.detail.backToProcurement")}
      </Link>

      </> /* end details tab */}

      {/* Return for Correction Modal */}
      <ReturnModal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        onConfirm={handleReturn}
        loading={returnLoading}
      />

      {/* Workflow Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl bg-white p-6 max-w-md w-full shadow-2xl border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50">
                <span className="material-symbols-outlined text-red-600 text-[20px]">cancel</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">{t("procurement.detail.rejectTitle")}</h3>
                <p className="text-xs text-neutral-400">{t("procurement.detail.reasonRequired")}</p>
              </div>
            </div>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder={t("procurement.detail.rejectPlaceholder")}
              rows={3}
              className="form-input resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={() => { setShowRejectModal(false); setRejectReason(""); }}
                className="btn-secondary flex-1 justify-center"
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleWorkflowReject}
                disabled={workflowLoading || !rejectReason.trim()}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {workflowLoading ? t("procurement.detail.rejecting") : t("procurement.detail.confirmRejection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HOD Approve / Reject Modal */}
      {hodAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setHodAction(null)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-9 w-9 rounded-xl flex items-center justify-center ${hodAction === "approve" ? "bg-teal-50" : "bg-red-50"}`}>
                <span className={`material-symbols-outlined text-[20px] ${hodAction === "approve" ? "text-teal-600" : "text-red-600"}`}>
                  {hodAction === "approve" ? "supervisor_account" : "person_off"}
                </span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">
                  {hodAction === "approve" ? t("procurement.detail.hodApproveTitle") : t("procurement.detail.hodRejectTitle")}
                </h2>
                <p className="text-xs text-neutral-500">{request.reference_number}</p>
              </div>
            </div>

            {hodError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{hodError}</div>
            )}

            {hodAction === "reject" && (
              <div>
                <label htmlFor="procurement-detail-rejection-reason" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                  {t("procurement.detail.rejectionReason")} <span className="text-red-500">*</span>
                </label>
                <textarea id="procurement-detail-rejection-reason"
                  className="form-input w-full h-24 resize-none"
                  placeholder={t("procurement.detail.hodRejectPlaceholder")}
                  value={hodRejReason}
                  onChange={(e) => setHodRejReason(e.target.value)}
                />
              </div>
            )}

            {hodAction === "approve" && (
              <p className="text-sm text-neutral-600">
                {(() => {
                  const [before, after = ""] = t("procurement.detail.hodApproveBody").split("{title}");
                  return <>{before}<strong>{request.title}</strong>{after}</>;
                })()}
              </p>
            )}

            <div className="flex gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setHodAction(null); setHodError(null); setHodRejReason(""); }}
                disabled={hodWorking}
              >
                {t("common.cancel")}
              </button>
              <button
                className={`flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors ${hodAction === "approve" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-600 hover:bg-red-700"}`}
                onClick={handleHodAction}
                disabled={hodWorking || (hodAction === "reject" && !hodRejReason.trim())}
              >
                {hodWorking ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">{hodAction === "approve" ? "check" : "close"}</span>
                )}
                {hodWorking ? t("procurement.detail.processing") : hodAction === "approve" ? t("procurement.detail.confirmApproval") : t("procurement.detail.confirmRejection")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award Contract Modal */}
      {showAward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowAward(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-1">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[20px]">emoji_events</span>
              </div>
              <div>
                <h2 className="text-base font-bold text-neutral-900">{t("procurement.detail.awardContract")}</h2>
                <p className="text-xs text-neutral-500">{request.reference_number}</p>
              </div>
            </div>

            {awardError && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-sm text-red-700">{awardError}</div>
            )}

            <div>
              <label htmlFor="procurement-detail-select-winning-quote" className="block text-xs font-semibold text-neutral-700 mb-1.5">
                {t("procurement.detail.selectWinningQuote")} <span className="text-red-500">*</span>
              </label>
              <select id="procurement-detail-select-winning-quote"
                className="form-input w-full"
                value={awardQuoteId}
                onChange={(e) => setAwardQuoteId(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">{t("procurement.detail.chooseQuote")}</option>
                {[...quotes].sort((a, b) => (a.quoted_amount ?? 0) - (b.quoted_amount ?? 0)).map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.vendor_name} — {q.currency ?? currency} {(q.quoted_amount ?? 0).toLocaleString()}
                    {q.is_recommended ? ` ★ ${t("procurement.detail.recommended")}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="procurement-detail-award-notes" className="block text-xs font-semibold text-neutral-700 mb-1.5">{t("procurement.detail.awardNotes")}</label>
              <textarea id="procurement-detail-award-notes"
                className="form-input w-full h-20 resize-none"
                placeholder={t("procurement.detail.awardNotesPlaceholder")}
                value={awardNotes}
                onChange={(e) => setAwardNotes(e.target.value)}
              />
            </div>

            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 space-y-2">
              <label htmlFor="procurement-detail-setawardcoideclared-e-target-checked-i-declare-t" className="flex items-start gap-2 text-sm">
                <input id="procurement-detail-setawardcoideclared-e-target-checked-i-declare-t"
                  type="checkbox"
                  className="mt-0.5"
                  checked={awardCoiDeclared}
                  onChange={(e) => setAwardCoiDeclared(e.target.checked)}
                />
                <span>{t("procurement.detail.coiDeclare")}</span>
              </label>
              <label htmlFor="procurement-detail-setawardcoiconflict-e-target-checked-i-have-a-co" className="flex items-start gap-2 text-sm">
                <input id="procurement-detail-setawardcoiconflict-e-target-checked-i-have-a-co"
                  type="checkbox"
                  className="mt-0.5"
                  checked={awardCoiConflict}
                  onChange={(e) => setAwardCoiConflict(e.target.checked)}
                />
                <span>{t("procurement.detail.coiConflict")}</span>
              </label>
              {awardCoiConflict && (
                <textarea
                  className="form-input w-full h-16 resize-none text-sm"
                  placeholder={t("procurement.detail.coiNotesPlaceholder")}
                  value={awardCoiNotes}
                  onChange={(e) => setAwardCoiNotes(e.target.value)}
                />
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                className="btn-secondary flex-1"
                onClick={() => { setShowAward(false); setAwardError(null); }}
                disabled={awarding}
              >
                {t("common.cancel")}
              </button>
              <button
                className="btn-primary flex-1 inline-flex items-center justify-center gap-1.5"
                onClick={handleAward}
                disabled={awarding || !awardQuoteId || !awardCoiDeclared || (awardCoiConflict && !awardCoiNotes.trim())}
              >
                {awarding ? (
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-[14px]">emoji_events</span>
                )}
                {awarding ? t("procurement.detail.awarding") : t("procurement.detail.confirmAward")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
