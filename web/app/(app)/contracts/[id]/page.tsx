"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { contractsApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const LIFECYCLE_BADGES: Record<string, string> = {
  DRAFT: "badge-muted", IN_REVIEW: "badge-warning", CHANGES_REQUESTED: "badge-warning",
  APPROVAL_PENDING: "badge-warning", APPROVED_FOR_SIGNATURE: "badge-primary",
  SENT_FOR_SIGNATURE: "badge-primary", PARTIALLY_SIGNED: "badge-primary",
  FULLY_EXECUTED: "badge-success", ACTIVE: "badge-success", COMPLETED: "badge-primary",
  CLOSING: "badge-muted", CLOSED: "badge-muted", REJECTED: "badge-danger",
  TERMINATED: "badge-danger", EXPIRED: "badge-danger",
};

type Tab = "overview" | "deliverables" | "financials" | "clauses" | "amendments" | "lifecycle" | "calloffs" | "documents" | "signatures" | "approvals" | "correspondence" | "audit";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contractId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const { prompt } = useConfirm();
  const { t } = useI18n();
  const user = getStoredUser();

  const [tab, setTab] = useState<Tab>("overview");
  const [commentModal, setCommentModal] = useState<null | "return" | "reject">(null);
  const [comment, setComment] = useState("");
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendType, setAmendType] = useState("value");
  const [amendReason, setAmendReason] = useState("");
  const [amendDelta, setAmendDelta] = useState("");
  const [lifecycleModal, setLifecycleModal] = useState<null | "suspend" | "terminate" | "extend" | "renew" | "calloff">(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [terminationType, setTerminationType] = useState("convenience");
  const [lcEndDate, setLcEndDate] = useState("");
  const [lcStartDate, setLcStartDate] = useState("");
  const [lcProcValidated, setLcProcValidated] = useState(false);
  const [lcBudgetConfirmed, setLcBudgetConfirmed] = useState(false);
  const [callOffTitle, setCallOffTitle] = useState("");
  const [callOffValue, setCallOffValue] = useState("");
  const [perfOpen, setPerfOpen] = useState(false);
  const [perf, setPerf] = useState({ delivery_score: 4, quality_score: 4, price_score: 4, compliance_score: 4, communication_score: 4, notes: "" });
  const [cmpFrom, setCmpFrom] = useState<number | "">("");
  const [cmpTo, setCmpTo] = useState<number | "">("");
  const [cmpResult, setCmpResult] = useState<{ segments: { type: string; text: string }[]; added: number; removed: number } | null>(null);

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ["contract", contractId],
    queryFn: () => contractsApi.get(contractId).then((r) => r.data.data),
    enabled: !!contractId,
  });

  const { data: readiness } = useQuery({
    queryKey: ["contract", contractId, "readiness"],
    queryFn: () => contractsApi.readiness(contractId).then((r) => r.data.data),
    enabled: !!contractId,
  });

  const { data: ledgerData } = useQuery({
    queryKey: ["contract", contractId, "ledger"],
    queryFn: () => contractsApi.ledger(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "financials",
  });

  const { data: auditData } = useQuery({
    queryKey: ["contract", contractId, "audit"],
    queryFn: () => contractsApi.audit(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "audit",
  });

  const { data: clauseData } = useQuery({
    queryKey: ["contract", contractId, "clauses"],
    queryFn: () => contractsApi.listClauses(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "clauses",
  });

  const { data: clauseLibrary } = useQuery({
    queryKey: ["contract-clause-library"],
    queryFn: () => contractsApi.clauseLibrary().then((r) => r.data.data).catch(() => []),
    enabled: !!contractId && tab === "clauses",
  });

  const { data: callOffData } = useQuery({
    queryKey: ["contract", contractId, "call-offs"],
    queryFn: () => contractsApi.callOffs(contractId).then((r) => r.data),
    enabled: !!contractId && tab === "calloffs",
  });

  const { data: correspondenceData } = useQuery({
    queryKey: ["contract", contractId, "correspondence"],
    queryFn: () => contractsApi.correspondence(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "correspondence",
  });

  const { data: invoiceData } = useQuery({
    queryKey: ["contract", contractId, "invoices"],
    queryFn: () => contractsApi.contractInvoices(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "financials",
  });

  const [corrOpen, setCorrOpen] = useState(false);
  const [corr, setCorr] = useState({ title: "", subject: "", body: "", type: "procurement" });

  const { data: disputeData } = useQuery({
    queryKey: ["contract", contractId, "disputes"],
    queryFn: () => contractsApi.disputes(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "lifecycle",
  });
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [dispute, setDispute] = useState({ type: "performance", description: "", amount_at_risk: "", legal_involved: false });

  const { data: personnelData } = useQuery({
    queryKey: ["contract", contractId, "key-personnel"],
    queryFn: () => contractsApi.keyPersonnel(contractId).then((r) => r.data.data),
    enabled: !!contractId && tab === "lifecycle",
  });
  const [personOpen, setPersonOpen] = useState(false);
  const [person, setPerson] = useState({ name: "", role: "", email: "", cv_reference: "" });
  const refreshPersonnel = () => qc.invalidateQueries({ queryKey: ["contract", contractId, "key-personnel"] });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract", contractId] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const act = (fn: () => Promise<unknown>, ok: string) => {
    fn().then(() => { toast.success(ok); refresh(); })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.common.actionFailed")));
  };

  const submitMut = useMutation({ mutationFn: () => contractsApi.submit(contractId), onSuccess: () => { toast.success(t("contracts.detail.toast.submitted")); refresh(); }, onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.submissionFailed")) });

  if (isLoading) return <div className="p-8 text-sm text-neutral-500">{t("contracts.detail.loading")}</div>;
  if (isError || !contract) return <div className="card p-6 text-center text-sm text-red-600">{t("contracts.detail.loadFailed")}</div>;

  const lifecycle = (contract.contract_status ?? contract.status ?? "DRAFT").toUpperCase();
  const canSubmit = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.submit", "contract.create"]));
  const canReview = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.review", "contract.approve"]));
  const canReject = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.reject", "contract.approve"]));
  const canAcceptDeliverable = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.accept_deliverable"]));
  const canAmend = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.create_amendment"]));
  const canApproveAmendment = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.approve_amendment"]));
  const canClose = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.close"]));
  const canSuspend = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.suspend"]));
  const canTerminate = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.terminate"]));
  const canSend = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.send"]));
  const canSign = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.sign_internal"]));
  const inReview = ["IN_REVIEW", "APPROVAL_PENDING"].includes(lifecycle);
  const isDraft = ["DRAFT", "CHANGES_REQUESTED"].includes(lifecycle);
  const readyForSignature = lifecycle === "APPROVED_FOR_SIGNATURE";
  const inSignature = ["SENT_FOR_SIGNATURE", "PARTIALLY_SIGNED"].includes(lifecycle);
  const sadcSignatory = (contract.signatories ?? []).find((s) => s.party === "sadcpf");
  const sadcSigned = sadcSignatory?.status === "signed";
  const isExecuted = ["FULLY_EXECUTED", "ACTIVE", "COMPLETED"].includes(lifecycle);
  const isActiveLifecycle = lifecycle === "ACTIVE";
  const isSuspended = lifecycle === "SUSPENDED";

  const runLifecycle = () => {
    if (!lifecycleModal) return;
    let action: () => Promise<unknown>;
    let msg: string;
    if (lifecycleModal === "suspend") {
      if (!lifecycleReason.trim()) return;
      action = () => contractsApi.suspend(contractId, lifecycleReason.trim()); msg = t("contracts.detail.toast.suspended");
    } else if (lifecycleModal === "terminate") {
      if (!lifecycleReason.trim()) return;
      action = () => contractsApi.terminate(contractId, terminationType, lifecycleReason.trim()); msg = t("contracts.detail.toast.terminated");
    } else if (lifecycleModal === "extend") {
      if (!lcEndDate || !lifecycleReason.trim()) return;
      action = () => contractsApi.createExtension(contractId, { proposed_end_date: lcEndDate, reason: lifecycleReason.trim() }); msg = t("contracts.detail.toast.extensionProposed");
    } else if (lifecycleModal === "renew") {
      if (!lcStartDate || !lcEndDate) return;
      action = () => contractsApi.createRenewal(contractId, { new_start_date: lcStartDate, new_end_date: lcEndDate, reason: lifecycleReason.trim() || undefined, procurement_validated: lcProcValidated, budget_confirmed: lcBudgetConfirmed }); msg = t("contracts.detail.toast.renewalProposed");
    } else {
      if (!callOffTitle.trim() || !lcStartDate || !lcEndDate || !callOffValue) return;
      action = () => contractsApi.createCallOff(contractId, { title: callOffTitle.trim(), start_date: lcStartDate, end_date: lcEndDate, value: Number(callOffValue) }); msg = t("contracts.detail.toast.callOffCreated");
    }
    act(action, msg);
    setLifecycleModal(null); setLifecycleReason(""); setLcEndDate(""); setLcStartDate(""); setLcProcValidated(false); setLcBudgetConfirmed(false); setCallOffTitle(""); setCallOffValue("");
  };

  const createAmendment = () => {
    contractsApi.createAmendment(contractId, { type: amendType, reason: amendReason.trim(), value_delta: amendDelta ? Number(amendDelta) : undefined })
      .then(() => { toast.success(t("contracts.detail.toast.amendmentCreated")); setAmendOpen(false); setAmendReason(""); setAmendDelta(""); refresh(); })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
  };

  const openExceptions = (contract.exceptions ?? []).filter((e) => e.status === "open");

  const submitComment = () => {
    if (!commentModal || !comment.trim()) return;
    const action = commentModal === "return"
      ? () => contractsApi.returnForCorrection(contractId, comment.trim())
      : () => contractsApi.rejectWorkflow(contractId, comment.trim());
    act(action, commentModal === "return" ? t("contracts.detail.toast.returned") : t("contracts.detail.toast.rejected"));
    setCommentModal(null); setComment("");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title={contract.title}
          subtitle={`${contract.reference_number} · ${contract.display_counterparty ?? contract.vendor?.name ?? "—"}`}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "nav.contracts", href: "/contracts" }, { label: "contracts.dashboard.register", href: "/contracts/register" }, { label: contract.reference_number }]} />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${LIFECYCLE_BADGES[lifecycle] ?? "badge-muted"}`}>{lifecycle in LIFECYCLE_BADGES || lifecycle === "SUSPENDED" ? t(`contracts.lifecycle.${lifecycle}`) : lifecycle.replace(/_/g, " ")}</span>
          {isDraft && canSubmit && (
            <button className="btn-primary text-sm disabled:opacity-60" disabled={submitMut.isPending || (readiness && !readiness.ready)} onClick={() => submitMut.mutate()}>
              {t("contracts.detail.submitForApproval")}
            </button>
          )}
          {inReview && canReview && (
            <>
              <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.approveWorkflow(contractId), t("contracts.detail.toast.approvalRecorded"))}>{t("common.approve")}</button>
              <button className="btn-secondary text-sm" onClick={() => { setCommentModal("return"); setComment(""); }}>{t("common.return")}</button>
              {canReject && <button className="btn-secondary text-sm text-red-600" onClick={() => { setCommentModal("reject"); setComment(""); }}>{t("common.reject")}</button>}
            </>
          )}
          {inReview && canSubmit && (
            <button className="btn-secondary text-sm" onClick={() => act(() => contractsApi.withdraw(contractId), t("contracts.detail.toast.withdrawn"))}>{t("contracts.detail.withdraw")}</button>
          )}
          {readyForSignature && canSend && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.sendForSignature(contractId), t("contracts.detail.toast.sentForSignature"))}>{t("contracts.detail.sendForSignature")}</button>
          )}
          {inSignature && canSign && !sadcSigned && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.signInternal(contractId), t("contracts.detail.toast.signatureRecorded"))}>{t("contracts.detail.signSadc")}</button>
          )}
          {isExecuted && canAmend && (
            <button className="btn-secondary text-sm" onClick={() => setAmendOpen(true)}>{t("contracts.detail.amend")}</button>
          )}
          {isExecuted && canClose && (
            <button className="btn-secondary text-sm" onClick={() => act(() => contractsApi.close(contractId), t("contracts.detail.toast.closed"))}>{t("contracts.detail.closeOut")}</button>
          )}
          {isActiveLifecycle && canSuspend && (
            <button className="btn-secondary text-sm" onClick={() => { setLifecycleModal("suspend"); setLifecycleReason(""); }}>{t("contracts.detail.suspend")}</button>
          )}
          {isSuspended && canSuspend && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.resume(contractId), t("contracts.detail.toast.resumed"))}>{t("contracts.detail.resume")}</button>
          )}
          {isActiveLifecycle && canAmend && (
            <button className="btn-secondary text-sm" onClick={() => { setLifecycleModal("extend"); setLifecycleReason(""); setLcEndDate(""); }}>{t("contracts.detail.extend")}</button>
          )}
          {isActiveLifecycle && canAmend && contract.renewal_type && contract.renewal_type !== "non_renewable" && (
            <button className="btn-secondary text-sm" onClick={() => { setLifecycleModal("renew"); setLifecycleReason(""); setLcStartDate(""); setLcEndDate(""); }}>{t("contracts.detail.renew")}</button>
          )}
          {(isExecuted || isSuspended) && canTerminate && (
            <button className="btn-secondary text-sm text-red-600" onClick={() => { setLifecycleModal("terminate"); setLifecycleReason(""); }}>{t("contracts.detail.terminate")}</button>
          )}
          {isExecuted && canAcceptDeliverable && contract.vendor_id && (
            <button className="btn-secondary text-sm" onClick={() => setPerfOpen(true)}>{t("contracts.detail.rateSupplier")}</button>
          )}
          <a href={contractsApi.packDownloadUrl(contractId)} className="btn-secondary text-sm inline-flex items-center gap-1">
            <span className="material-symbols-outlined text-[16px]">inventory_2</span>{t("contracts.detail.contractPack")}
          </a>
        </div>
      </div>

      {openExceptions.length > 0 && (
        <div className="space-y-2">
          {openExceptions.map((e) => (
            <div key={e.id} className={`rounded-lg border px-4 py-2 text-sm ${e.severity === "critical" ? "bg-red-50 border-red-200 text-red-700" : e.severity === "high" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <span className="font-semibold uppercase text-[10px] mr-2">{e.severity}</span>{e.title}
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["overview", "deliverables", "financials", "clauses", "amendments", "lifecycle", ...(contract.is_framework ? ["calloffs" as Tab] : []), "documents", "signatures", "approvals", "correspondence", "audit"] as Tab[]).map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === tb ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
            {t(`contracts.detail.tab.${tb}`)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">{t("contracts.detail.keyFacts")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">{t("contracts.field.type")}</dt><dd className="text-neutral-900">{contract.type?.name ?? "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.create.step.origin")}</dt><dd className="text-neutral-900 capitalize">{contract.origin_type ?? "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.field.value")}</dt><dd className="text-neutral-900 font-semibold">{contract.currency} {Number(contract.current_value ?? contract.value).toLocaleString()}</dd>
              {contract.budget_currency && (<><dt className="text-neutral-500">{t("contracts.create.budgetCurrency")}</dt><dd className="text-neutral-900">{contract.budget_currency}{contract.converted_value != null ? ` · ${Number(contract.converted_value).toLocaleString()}` : ""}{contract.conversion_reference ? ` (${contract.conversion_reference})` : ""}</dd></>)}
              <dt className="text-neutral-500">{t("contracts.detail.start")}</dt><dd className="text-neutral-900">{contract.start_date ? formatDateShort(contract.start_date) : "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.detail.end")}</dt><dd className="text-neutral-900">{contract.end_date ? formatDateShort(contract.end_date) : "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.detail.signature")}</dt><dd className="text-neutral-900">{contract.signature_status ?? "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.detail.health")}</dt><dd className="text-neutral-900 capitalize">{contract.health_status ?? t("contracts.detail.healthNormal")}</dd>
            </dl>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">{t("contracts.detail.readiness")}</h3>
            {readiness ? (
              <ul className="space-y-1.5 text-sm">
                {readiness.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${c.passed ? "text-green-600" : c.blocking ? "text-red-600" : "text-amber-600"}`}>
                      {c.passed ? "check_circle" : "cancel"}
                    </span>
                    <span className={c.passed ? "text-neutral-700" : "text-neutral-900"}>{c.label}{!c.blocking && !c.passed ? ` ${t("contracts.common.optionalParen")}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-400">{t("common.loading")}</p>}
          </div>
        </div>
      )}

      {tab === "deliverables" && (
        <div className="card overflow-hidden">
          {(contract.deliverables ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.detail.noDeliverables")}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>#</th><th>{t("contracts.detail.deliverable")}</th><th>{t("contracts.detail.responsible")}</th><th>{t("contracts.detail.due")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
              <tbody>
                {(contract.deliverables ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">{d.number}</td>
                    <td className="text-sm font-medium text-neutral-800">{d.name}</td>
                    <td className="text-sm text-neutral-600 capitalize">{d.responsible_party}</td>
                    <td className="text-sm text-neutral-500">{d.due_date ? formatDateShort(d.due_date) : "—"}</td>
                    <td className="text-sm capitalize">{d.status.replace(/_/g, " ")}</td>
                    <td className="text-right">
                      {canAcceptDeliverable && !["accepted", "waived"].includes(d.status) && (
                        <div className="flex justify-end gap-1">
                          <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.reviewDeliverable(contractId, d.id, "accept"), t("contracts.detail.toast.deliverableAccepted"))}>{t("contracts.detail.accept")}</button>
                          <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => act(() => contractsApi.reviewDeliverable(contractId, d.id, "reject"), t("contracts.detail.toast.deliverableRejected"))}>{t("common.reject")}</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "financials" && (
        <div className="space-y-4">
          {ledgerData ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {([
                ["contracts.detail.originalValue", ledgerData.ledger.original],
                ["contracts.analytics.currentValue", ledgerData.ledger.current],
                ["contracts.settings.ceiling", ledgerData.ledger.ceiling],
                ["contracts.detail.paid", ledgerData.ledger.paid],
                ["contracts.detail.approvedUnpaid", ledgerData.ledger.approved_unpaid],
                ["contracts.detail.remaining", ledgerData.ledger.remaining],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="card p-4">
                  <p className="text-2xl font-bold text-neutral-900">{ledgerData.ledger.currency} {Number(val).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t(label)}</p>
                </div>
              ))}
            </div>
          ) : <div className="card p-6 text-sm text-neutral-500">{t("contracts.detail.loadingLedger")}</div>}
          {ledgerData && ledgerData.schedules.length > 0 && (
            <div className="card overflow-hidden">
              <table className="data-table">
                <thead><tr><th>{t("contracts.detail.milestone")}</th><th>{t("contracts.detail.basis")}</th><th className="text-right">{t("contracts.detail.amount")}</th><th>{t("contracts.field.status")}</th></tr></thead>
                <tbody>
                  {ledgerData.schedules.map((s) => (
                    <tr key={s.id}>
                      <td className="text-sm font-medium text-neutral-800">{s.name}</td>
                      <td className="text-sm capitalize">{s.basis}</td>
                      <td className="text-right text-sm">{ledgerData.ledger.currency} {Number(s.amount ?? 0).toLocaleString()}</td>
                      <td className="text-sm capitalize">{s.status.replace(/_/g, " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.detail.linkedInvoices")}</div>
            {(invoiceData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noInvoices")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.detail.invoice")}</th><th>{t("contracts.detail.milestone")}</th><th>{t("contracts.detail.deliverable")}</th><th className="text-right">{t("contracts.detail.amount")}</th><th>{t("contracts.detail.due")}</th><th>{t("contracts.field.status")}</th></tr></thead>
                <tbody>
                  {(invoiceData ?? []).map((inv) => (
                    <tr key={inv.id}>
                      <td className="text-sm font-mono">{inv.vendor_invoice_number ?? inv.reference_number}</td>
                      <td className="text-sm text-neutral-600">{inv.contract_payment_schedule?.name ?? "—"}</td>
                      <td className="text-sm text-neutral-600">{inv.contract_payment_schedule?.trigger_deliverable?.name ?? "—"}</td>
                      <td className="text-right text-sm">{inv.currency} {Number(inv.amount).toLocaleString()}</td>
                      <td className="text-sm">{inv.due_date ? formatDateShort(inv.due_date) : "—"}</td>
                      <td className="text-xs capitalize">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "clauses" && (
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.detail.assignedClauses")}</div>
            {(clauseData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noClauses")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.detail.clause")}</th><th>{t("contracts.field.type")}</th><th>{t("contracts.detail.deviation")}</th><th></th></tr></thead>
                <tbody>
                  {(clauseData ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="text-sm font-medium text-neutral-800">{a.clause?.title ?? a.clause?.key}</td>
                      <td className="text-xs capitalize text-neutral-500">{(a.clause?.clause_type ?? "").replace(/_/g, " ")}</td>
                      <td className="text-sm">{a.is_deviation ? <span className="badge badge-warning">{t("contracts.detail.deviationStatus", { status: a.deviation_status ?? "" })}</span> : "—"}</td>
                      <td className="text-right">
                        {canAmend && (
                          <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => act(() => contractsApi.unassignClause(contractId, a.id), t("contracts.detail.toast.clauseRemoved"))}>{t("contracts.detail.remove")}</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {canAmend && (clauseLibrary ?? []).length > 0 && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-neutral-600 mb-2">{t("contracts.detail.addClause")}</p>
              <div className="flex flex-wrap gap-2">
                {(clauseLibrary ?? []).filter((lib) => !(clauseData ?? []).some((a) => a.clause_id === lib.id)).map((lib) => (
                  <button key={lib.id} className="btn-secondary text-xs" onClick={() => act(() => contractsApi.assignClause(contractId, lib.id), t("contracts.detail.toast.clauseAssigned"))}>
                    + {lib.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "amendments" && (
        <div className="card overflow-hidden">
          {(contract.amendments ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.detail.noAmendments")}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t("contracts.field.reference")}</th><th>{t("contracts.field.type")}</th><th className="text-right">{t("contracts.detail.deltaValue")}</th><th className="text-right">{t("contracts.detail.revised")}</th><th>{t("contracts.detail.material")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
              <tbody>
                {(contract.amendments ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs text-neutral-700">{a.reference_number}</td>
                    <td className="text-sm capitalize">{a.type}</td>
                    <td className="text-right text-sm">{a.value_delta != null ? Number(a.value_delta).toLocaleString() : "—"}</td>
                    <td className="text-right text-sm font-semibold">{a.revised_value != null ? Number(a.revised_value).toLocaleString() : "—"}</td>
                    <td className="text-sm">{a.is_material ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                    <td className="text-sm capitalize">{a.status}</td>
                    <td className="text-right">
                      {canApproveAmendment && a.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveAmendment(contractId, a.id), t("contracts.detail.toast.amendmentApproved"))}>{t("common.approve")}</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "lifecycle" && (
        <div className="space-y-4">
          <div className="card p-4 text-sm text-neutral-600">
            {t("contracts.detail.renewalType")} <span className="font-medium text-neutral-900">{contract.renewal_type ? contract.renewal_type.replace(/_/g, " ") : t("contracts.detail.notSet")}</span>
            {contract.auto_renew && <span className="ml-2 badge badge-warning">{t("contracts.detail.autoRenews")}</span>}
            <span className="ml-2 text-neutral-500">{t("contracts.detail.renewalsCount", { count: contract.renewals_count ?? 0 })}</span>
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.detail.extensions")}</div>
            {(contract.extensions ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noExtensions")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.detail.proposedEnd")}</th><th>{t("common.reason")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
                <tbody>
                  {(contract.extensions ?? []).map((e) => (
                    <tr key={e.id}>
                      <td className="text-sm">{e.proposed_end_date ? formatDateShort(e.proposed_end_date) : "—"}</td>
                      <td className="text-sm text-neutral-700">{e.reason}</td>
                      <td className="text-sm capitalize">{e.status}</td>
                      <td className="text-right">{canApproveAmendment && e.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveExtension(contractId, e.id), t("contracts.detail.toast.extensionApproved"))}>{t("common.approve")}</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">{t("contracts.detail.renewals")}</div>
            {(contract.renewals ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noRenewals")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>{t("contracts.detail.newPeriod")}</th><th>{t("contracts.detail.procurement")}</th><th>{t("contracts.detail.budget")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
                <tbody>
                  {(contract.renewals ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm">{r.renewal_number}</td>
                      <td className="text-sm">{formatDateShort(r.new_start_date)} → {formatDateShort(r.new_end_date)}</td>
                      <td className="text-sm">{r.procurement_validated ? "✓" : "—"}</td>
                      <td className="text-sm">{r.budget_confirmed ? "✓" : "—"}</td>
                      <td className="text-sm capitalize">{r.status}</td>
                      <td className="text-right">{canApproveAmendment && r.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveRenewal(contractId, r.id), t("contracts.detail.toast.renewalApproved"))}>{t("common.approve")}</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {((contract.suspensions ?? []).length > 0 || (contract.terminations ?? []).length > 0) && (
            <div className="card p-4 space-y-2 text-sm">
              {(contract.suspensions ?? []).map((s) => (
                <div key={`s${s.id}`} className="text-neutral-600"><span className="badge badge-muted mr-2">{t("contracts.detail.suspension")}</span>{s.reason} — {s.status}</div>
              ))}
              {(contract.terminations ?? []).map((term) => (
                <div key={`t${term.id}`} className="text-neutral-600"><span className="badge badge-danger mr-2">{t("contracts.detail.terminationType", { type: term.type })}</span>{term.reason}</div>
              ))}
            </div>
          )}

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">{t("contracts.detail.keyPersonnel")}</span>
              <button className="btn-secondary text-xs" onClick={() => setPersonOpen(true)}>{t("contracts.detail.addPersonnel")}</button>
            </div>
            {(personnelData?.personnel ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noPersonnel")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.field.name")}</th><th>{t("contracts.detail.role")}</th><th>{t("contracts.detail.cvRef")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
                <tbody>
                  {(personnelData?.personnel ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="text-sm text-neutral-800">{p.name}</td>
                      <td className="text-sm text-neutral-600">{p.role}</td>
                      <td className="text-xs text-neutral-500">{p.cv_reference ?? "—"}</td>
                      <td className="text-xs capitalize">{p.status}</td>
                      <td className="text-right">{p.status === "active" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={async () => {
                          const proposed_name = await prompt({ title: "contracts.detail.requestReplacement", label: "contracts.detail.replacementName", required: true });
                          if (!proposed_name) return;
                          const reason = (await prompt({ title: "contracts.detail.requestReplacement", label: "contracts.detail.replacementReason" })) ?? "";
                          contractsApi.requestPersonnelReplacement(contractId, p.id, { proposed_name, proposed_role: p.role, reason })
                            .then(() => { toast.success(t("contracts.detail.toast.replacementRequested")); refreshPersonnel(); })
                            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
                        }}>{t("contracts.detail.requestReplacement")}</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(personnelData?.pending_replacements ?? []).length > 0 && (
              <div className="p-4 border-t border-neutral-100 space-y-2">
                <p className="text-xs font-semibold text-neutral-600">{t("contracts.detail.pendingReplacements")}</p>
                {(personnelData?.pending_replacements ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">→ {r.proposed_name} ({r.proposed_role}) — {r.reason}</span>
                    {canApproveAmendment && (
                      <span className="flex gap-2">
                        <button className="btn-secondary text-xs py-0.5" onClick={() => contractsApi.approvePersonnelReplacement(contractId, r.id).then(() => { toast.success(t("contracts.detail.toast.replacementApproved")); refreshPersonnel(); }).catch(() => toast.error(t("contracts.detail.toast.failed")))}>{t("common.approve")}</button>
                        <button className="btn-secondary text-xs py-0.5" onClick={() => contractsApi.rejectPersonnelReplacement(contractId, r.id).then(() => { toast.success(t("contracts.detail.toast.replacementRejected")); refreshPersonnel(); }).catch(() => toast.error(t("contracts.detail.toast.failed")))}>{t("common.reject")}</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">{t("contracts.detail.disputes")}</span>
              <button className="btn-secondary text-xs" onClick={() => setDisputeOpen(true)}>{t("contracts.detail.raiseDispute")}</button>
            </div>
            {(disputeData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noDisputes")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.detail.raised")}</th><th>{t("contracts.field.type")}</th><th>{t("contracts.detail.description")}</th><th>{t("contracts.detail.atRisk")}</th><th>{t("contracts.detail.legal")}</th><th>{t("contracts.field.status")}</th><th></th></tr></thead>
                <tbody>
                  {(disputeData ?? []).map((d) => (
                    <tr key={d.id}>
                      <td className="text-sm whitespace-nowrap">{d.date_raised ? formatDateShort(d.date_raised) : "—"}</td>
                      <td className="text-xs capitalize">{d.type}</td>
                      <td className="text-sm text-neutral-700 max-w-[16rem] truncate">{d.description}</td>
                      <td className="text-sm">{d.amount_at_risk != null ? Number(d.amount_at_risk).toLocaleString() : "—"}</td>
                      <td className="text-sm">{d.legal_involved ? t("contracts.common.yes") : "—"}</td>
                      <td className="text-xs capitalize">{d.status.replace(/_/g, " ")}</td>
                      <td className="text-right">{!["resolved", "closed"].includes(d.status) && (
                        <button className="btn-secondary text-xs py-0.5" onClick={async () => {
                          const resolution = await prompt({ title: "contracts.detail.resolveDispute", label: "contracts.detail.resolutionNote" });
                          if (resolution === null) return;
                          contractsApi.updateDispute(contractId, d.id, { status: "resolved", resolution })
                            .then(() => { toast.success(t("contracts.detail.toast.disputeResolved")); qc.invalidateQueries({ queryKey: ["contract", contractId, "disputes"] }); })
                            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
                        }}>{t("contracts.detail.resolve")}</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "calloffs" && (
        <div className="space-y-4">
          {callOffData?.utilisation && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {([
                ["contracts.settings.ceiling", callOffData.utilisation.ceiling],
                ["contracts.detail.used", callOffData.utilisation.used],
                ["contracts.detail.remaining", callOffData.utilisation.remaining],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="card p-4">
                  <p className="text-2xl font-bold text-neutral-900">{callOffData.utilisation!.currency} {Number(val).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{t(label)}</p>
                </div>
              ))}
              <div className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{callOffData.utilisation.call_off_count}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{t("contracts.detail.tab.calloffs")}</p>
              </div>
            </div>
          )}
          <div className="card overflow-hidden">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">{t("contracts.detail.tab.calloffs")}</span>
              {canAmend && (
                <button className="btn-secondary text-xs" onClick={() => { setLifecycleModal("calloff"); setLifecycleReason(""); setLcStartDate(""); setLcEndDate(""); setCallOffTitle(""); setCallOffValue(""); }}>{t("contracts.detail.newCallOff")}</button>
              )}
            </div>
            {(callOffData?.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">{t("contracts.detail.noCallOffs")}</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>{t("contracts.field.reference")}</th><th>{t("contracts.field.title")}</th><th className="text-right">{t("contracts.field.value")}</th><th>{t("contracts.detail.ends")}</th><th>{t("contracts.field.status")}</th></tr></thead>
                <tbody>
                  {(callOffData?.data ?? []).map((c) => (
                    <tr key={c.id}>
                      <td><Link href={`/contracts/${c.id}`} className="font-mono text-xs text-primary">{c.reference_number}</Link></td>
                      <td className="text-sm text-neutral-800">{c.title}</td>
                      <td className="text-right text-sm">{c.currency} {Number(c.current_value ?? c.value).toLocaleString()}</td>
                      <td className="text-sm text-neutral-500">{c.end_date ? formatDateShort(c.end_date) : "—"}</td>
                      <td className="text-sm capitalize">{(c.contract_status ?? c.status ?? "").toString().replace(/_/g, " ").toLowerCase()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {tab === "documents" && (() => {
        const workingVersions = (contract.document_versions ?? []).filter((d) => d.kind === "working");
        const runCompare = () => {
          if (!cmpFrom || !cmpTo) return;
          contractsApi.compareDocuments(contractId, Number(cmpFrom), Number(cmpTo))
            .then((r) => setCmpResult(r.data.data))
            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.compareFailed")));
        };
        return (
        <div className="space-y-4">
        <div className="card overflow-hidden">
          {(contract.document_versions ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.detail.noDocuments")}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t("contracts.templates.version")}</th><th>{t("contracts.detail.kind")}</th><th>{t("contracts.detail.hash")}</th><th>{t("contracts.detail.generated")}</th><th>{t("contracts.detail.locked")}</th></tr></thead>
              <tbody>
                {(contract.document_versions ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">v{d.version}</td>
                    <td className="text-sm capitalize">{d.kind}</td>
                    <td className="font-mono text-[11px] text-neutral-500">{d.hash ? `${d.hash.slice(0, 16)}…` : "—"}</td>
                    <td className="text-sm text-neutral-500">{d.generated_at ? formatDateShort(d.generated_at) : "—"}</td>
                    <td className="text-sm">{d.is_locked ? t("contracts.common.yes") : t("contracts.common.no")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {workingVersions.length >= 2 && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-800">{t("contracts.detail.compareDrafts")}</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="form-input w-auto" value={cmpFrom} onChange={(e) => setCmpFrom(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("contracts.detail.fromVersion")}</option>
                {workingVersions.map((d) => <option key={d.id} value={d.id}>v{d.version}</option>)}
              </select>
              <span className="text-neutral-400">→</span>
              <select className="form-input w-auto" value={cmpTo} onChange={(e) => setCmpTo(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{t("contracts.detail.toVersion")}</option>
                {workingVersions.map((d) => <option key={d.id} value={d.id}>v{d.version}</option>)}
              </select>
              <button className="btn-secondary text-sm" disabled={!cmpFrom || !cmpTo || cmpFrom === cmpTo} onClick={runCompare}>{t("contracts.detail.compare")}</button>
            </div>
            {cmpResult && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">{t("contracts.detail.compareSummary", { added: cmpResult.added, removed: cmpResult.removed })}</p>
                <pre className="text-xs bg-neutral-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap">
                  {cmpResult.segments.map((s, i) => (
                    <div key={i} className={s.type === "added" ? "text-green-700 bg-green-50" : s.type === "removed" ? "text-red-700 bg-red-50 line-through" : "text-neutral-600"}>
                      {s.type === "added" ? "+ " : s.type === "removed" ? "- " : "  "}{s.text}
                    </div>
                  ))}
                </pre>
              </div>
            )}
          </div>
        )}
        </div>
        );
      })()}

      {tab === "signatures" && (
        <div className="card overflow-hidden">
          {(contract.signatories ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.detail.notSent")}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t("contracts.detail.order")}</th><th>{t("contracts.detail.party")}</th><th>{t("contracts.detail.signatory")}</th><th>{t("contracts.detail.method")}</th><th>{t("contracts.field.status")}</th><th>{t("contracts.detail.signed")}</th></tr></thead>
              <tbody>
                {[...(contract.signatories ?? [])].sort((a, b) => a.sign_order - b.sign_order).map((s) => (
                  <tr key={s.id}>
                    <td className="text-sm">{s.sign_order}</td>
                    <td className="text-sm capitalize">{s.party === "sadcpf" ? "SADC PF" : t("contracts.field.counterparty")}</td>
                    <td className="text-sm text-neutral-700">{s.signer_name ?? s.signer_email ?? "—"}</td>
                    <td className="text-sm capitalize">{s.method}</td>
                    <td className="text-sm capitalize">{s.status.replace(/_/g, " ")}{s.decline_reason ? ` — ${s.decline_reason}` : ""}</td>
                    <td className="text-sm text-neutral-500">{s.signed_at ? formatDateShort(s.signed_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "approvals" && (
        <div className="card p-5">
          {contract.approval_request ? (
            <ApprovalTimeline request={contract.approval_request} />
          ) : (
            <p className="text-sm text-neutral-500">{t("contracts.detail.notSubmitted")}</p>
          )}
        </div>
      )}

      {tab === "correspondence" && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800">{t("contracts.detail.linkedCorrespondence")}</span>
            <button className="btn-secondary text-xs" onClick={() => setCorrOpen(true)}>{t("contracts.detail.createCorrespondence")}</button>
          </div>
          {(correspondenceData ?? []).length === 0 ? (
            <p className="p-6 text-sm text-neutral-400">{t("contracts.detail.noCorrespondence")}</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t("contracts.field.reference")}</th><th>{t("contracts.field.title")}</th><th>{t("contracts.field.type")}</th><th>{t("contracts.detail.direction")}</th><th>{t("contracts.field.status")}</th><th>{t("contracts.detail.created")}</th></tr></thead>
              <tbody>
                {(correspondenceData ?? []).map((c) => (
                  <tr key={c.id}>
                    <td className="text-sm font-mono">{c.reference_number ?? "—"}</td>
                    <td className="text-sm text-neutral-800">{c.title}</td>
                    <td className="text-xs capitalize text-neutral-500">{c.type.replace(/_/g, " ")}</td>
                    <td className="text-xs capitalize text-neutral-500">{c.direction}</td>
                    <td className="text-xs capitalize">{c.status}</td>
                    <td className="text-sm text-neutral-500 whitespace-nowrap">{c.created_at ? formatDateShort(c.created_at) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "audit" && (
        <div className="card overflow-hidden">
          {(auditData ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">{t("contracts.detail.noAudit")}</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>{t("contracts.detail.when")}</th><th>{t("contracts.detail.event")}</th></tr></thead>
              <tbody>
                {(auditData ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="text-sm text-neutral-500 whitespace-nowrap">{e.created_at ? formatDateShort(e.created_at) : "—"}</td>
                    <td className="text-sm text-neutral-800">{e.event.replace(/^contract\./, "").replace(/_/g, " ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {personOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPersonOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{t("contracts.detail.addKeyPersonnel")}</h3>
            <input className="form-input" placeholder={t("contracts.field.name")} value={person.name} onChange={(e) => setPerson((p) => ({ ...p, name: e.target.value }))} />
            <input className="form-input" placeholder={t("contracts.detail.role")} value={person.role} onChange={(e) => setPerson((p) => ({ ...p, role: e.target.value }))} />
            <input className="form-input" placeholder={t("contracts.detail.emailOptional")} value={person.email} onChange={(e) => setPerson((p) => ({ ...p, email: e.target.value }))} />
            <input className="form-input" placeholder={t("contracts.detail.cvOptional")} value={person.cv_reference} onChange={(e) => setPerson((p) => ({ ...p, cv_reference: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPersonOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1" disabled={!person.name.trim() || !person.role.trim()}
                onClick={() => {
                  contractsApi.addKeyPersonnel(contractId, { name: person.name, role: person.role, email: person.email || undefined, cv_reference: person.cv_reference || undefined })
                    .then(() => { toast.success(t("contracts.detail.toast.personnelAdded")); setPersonOpen(false); setPerson({ name: "", role: "", email: "", cv_reference: "" }); refreshPersonnel(); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
                }}>{t("common.add")}</button>
            </div>
          </div>
        </div>
      )}

      {disputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDisputeOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{t("contracts.detail.raiseDispute")}</h3>
            <select className="form-input" value={dispute.type} onChange={(e) => setDispute((p) => ({ ...p, type: e.target.value }))}>
              {["payment", "performance", "scope", "delay", "quality", "other"].map((dt) => <option key={dt} value={dt}>{t(`contracts.detail.disputeType.${dt}`)}</option>)}
            </select>
            <textarea className="form-input h-24 resize-none" placeholder={t("contracts.detail.description")} value={dispute.description} onChange={(e) => setDispute((p) => ({ ...p, description: e.target.value }))} />
            <input className="form-input" type="number" placeholder={t("contracts.detail.amountAtRisk")} value={dispute.amount_at_risk} onChange={(e) => setDispute((p) => ({ ...p, amount_at_risk: e.target.value }))} />
            <label htmlFor="contract-dispute-legal-involved" className="flex items-center gap-2 text-sm text-neutral-600"><input id="contract-dispute-legal-involved" type="checkbox" checked={dispute.legal_involved} onChange={(e) => setDispute((p) => ({ ...p, legal_involved: e.target.checked }))} /> {t("contracts.detail.legalInvolved")}</label>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDisputeOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1" disabled={!dispute.description.trim()}
                onClick={() => {
                  contractsApi.createDispute(contractId, {
                    type: dispute.type, description: dispute.description, legal_involved: dispute.legal_involved,
                    amount_at_risk: dispute.amount_at_risk ? Number(dispute.amount_at_risk) : undefined,
                  }).then(() => { toast.success(t("contracts.detail.toast.disputeRecorded")); setDisputeOpen(false); setDispute({ type: "performance", description: "", amount_at_risk: "", legal_involved: false }); qc.invalidateQueries({ queryKey: ["contract", contractId, "disputes"] }); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
                }}>{t("contracts.detail.raise")}</button>
            </div>
          </div>
        </div>
      )}

      {corrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCorrOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{t("contracts.detail.createCorrespondence")}</h3>
            <p className="text-xs text-neutral-500">{t("contracts.detail.correspondenceHint")}</p>
            <input className="form-input" placeholder={t("contracts.field.title")} value={corr.title} onChange={(e) => setCorr((p) => ({ ...p, title: e.target.value }))} />
            <input className="form-input" placeholder={t("contracts.detail.subject")} value={corr.subject} onChange={(e) => setCorr((p) => ({ ...p, subject: e.target.value }))} />
            <select className="form-input" value={corr.type} onChange={(e) => setCorr((p) => ({ ...p, type: e.target.value }))}>
              <option value="procurement">{t("contracts.detail.procurement")}</option>
              <option value="external">{t("contracts.detail.corrType.external")}</option>
              <option value="internal_memo">{t("contracts.detail.corrType.internalMemo")}</option>
              <option value="diplomatic_note">{t("contracts.detail.corrType.diplomaticNote")}</option>
            </select>
            <textarea className="form-input h-24 resize-none" placeholder={t("contracts.detail.bodyOptional")} value={corr.body} onChange={(e) => setCorr((p) => ({ ...p, body: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCorrOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1" disabled={!corr.title.trim() || !corr.subject.trim()}
                onClick={() => {
                  contractsApi.createCorrespondence(contractId, corr)
                    .then(() => { toast.success(t("contracts.detail.toast.correspondenceCreated")); setCorrOpen(false); setCorr({ title: "", subject: "", body: "", type: "procurement" }); qc.invalidateQueries({ queryKey: ["contract", contractId, "correspondence"] }); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t("contracts.detail.toast.failed")));
                }}>{t("common.create")}</button>
            </div>
          </div>
        </div>
      )}

      {perfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPerfOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{t("contracts.detail.ratePerformance")}</h3>
            {([
              ["delivery_score", "contracts.detail.perf.delivery"], ["quality_score", "contracts.detail.perf.quality"], ["price_score", "contracts.detail.perf.price"],
              ["compliance_score", "contracts.detail.perf.compliance"], ["communication_score", "contracts.detail.perf.communication"],
            ] as [keyof typeof perf, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label htmlFor={`contract-perf-${key}`} className="text-sm text-neutral-700">{t(label)}</label>
                <select id={`contract-perf-${key}`} className="form-input w-24" value={perf[key] as number} onChange={(e) => setPerf((p) => ({ ...p, [key]: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
            <textarea className="form-input h-20 resize-none" placeholder={t("contracts.detail.perfNotes")} value={perf.notes} onChange={(e) => setPerf((p) => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPerfOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1" onClick={() => { act(() => contractsApi.submitPerformanceReview(contractId, perf), t("contracts.detail.toast.performanceRecorded")); setPerfOpen(false); }}>{t("contracts.detail.saveRating")}</button>
            </div>
          </div>
        </div>
      )}

      {lifecycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLifecycleModal(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900 capitalize">{t(`contracts.detail.lcTitle.${lifecycleModal}`)}</h3>
            {lifecycleModal === "terminate" && (
              <div className="space-y-1">
                <label htmlFor="contract-lifecycle-termination-type" className="text-xs font-semibold text-neutral-600">{t("contracts.detail.terminationTypeLabel")}</label>
                <select id="contract-lifecycle-termination-type" className="form-input" value={terminationType} onChange={(e) => setTerminationType(e.target.value)}>
                  {["convenience", "cause", "mutual", "force_majeure", "other"].map((tt) => (
                    <option key={tt} value={tt} className="capitalize">{t(`contracts.detail.termType.${tt}`)}</option>
                  ))}
                </select>
              </div>
            )}
            {lifecycleModal === "calloff" && (
              <div className="space-y-1">
                <label htmlFor="contract-lifecycle-calloff-title" className="text-xs font-semibold text-neutral-600">{t("contracts.detail.callOffTitle")} <span className="text-red-500">*</span></label>
                <input id="contract-lifecycle-calloff-title" className="form-input" value={callOffTitle} onChange={(e) => setCallOffTitle(e.target.value)} />
                <label htmlFor="contract-lifecycle-calloff-value" className="text-xs font-semibold text-neutral-600 mt-2 block">{t("contracts.field.value")} <span className="text-red-500">*</span></label>
                <input id="contract-lifecycle-calloff-value" type="number" min="0" step="0.01" className="form-input" value={callOffValue} onChange={(e) => setCallOffValue(e.target.value)} />
              </div>
            )}
            {(lifecycleModal === "renew" || lifecycleModal === "calloff") && (
              <div className="space-y-1">
                <label htmlFor="contract-lifecycle-start-date" className="text-xs font-semibold text-neutral-600">{lifecycleModal === "calloff" ? t("common.startDate") : t("contracts.detail.newStartDate")} <span className="text-red-500">*</span></label>
                <input id="contract-lifecycle-start-date" type="date" className="form-input" value={lcStartDate} onChange={(e) => setLcStartDate(e.target.value)} />
              </div>
            )}
            {(lifecycleModal === "extend" || lifecycleModal === "renew" || lifecycleModal === "calloff") && (
              <div className="space-y-1">
                <label htmlFor="contract-lifecycle-end-date" className="text-xs font-semibold text-neutral-600">{lifecycleModal === "extend" ? t("contracts.detail.proposedEndDate") : t("common.endDate")} <span className="text-red-500">*</span></label>
                <input id="contract-lifecycle-end-date" type="date" className="form-input" value={lcEndDate} onChange={(e) => setLcEndDate(e.target.value)} />
              </div>
            )}
            {lifecycleModal === "renew" && (
              <div className="space-y-2">
                <label htmlFor="contract-lifecycle-proc-validated" className="flex items-center gap-2 text-sm text-neutral-600"><input id="contract-lifecycle-proc-validated" type="checkbox" checked={lcProcValidated} onChange={(e) => setLcProcValidated(e.target.checked)} /> {t("contracts.detail.procValidated")}</label>
                <label htmlFor="contract-lifecycle-budget-confirmed" className="flex items-center gap-2 text-sm text-neutral-600"><input id="contract-lifecycle-budget-confirmed" type="checkbox" checked={lcBudgetConfirmed} onChange={(e) => setLcBudgetConfirmed(e.target.checked)} /> {t("contracts.detail.budgetConfirmed")}</label>
              </div>
            )}
            {lifecycleModal !== "calloff" && (
              <div className="space-y-1">
                <label htmlFor="contract-lifecycle-reason" className="text-xs font-semibold text-neutral-600">{t("common.reason")} {!["renew"].includes(lifecycleModal) && <span className="text-red-500">*</span>}</label>
                <textarea id="contract-lifecycle-reason" className="form-input h-20 resize-none" value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} />
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setLifecycleModal(null)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1 capitalize" onClick={runLifecycle}>{t(`contracts.detail.lcAction.${lifecycleModal}`)}</button>
            </div>
          </div>
        </div>
      )}

      {amendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAmendOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{t("contracts.detail.createAmendment")}</h3>
            <div className="space-y-1">
              <label htmlFor="contract-amend-type" className="text-xs font-semibold text-neutral-600">{t("contracts.field.type")}</label>
              <select id="contract-amend-type" className="form-input" value={amendType} onChange={(e) => setAmendType(e.target.value)}>
                {["value", "duration", "scope", "deliverables", "key_personnel", "funding", "administrative", "other"].map((at) => (
                  <option key={at} value={at} className="capitalize">{t(`contracts.detail.amendType.${at}`)}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label htmlFor="contract-amend-delta" className="text-xs font-semibold text-neutral-600">{t("contracts.detail.valueChange")}</label>
              <input id="contract-amend-delta" type="number" step="0.01" className="form-input" value={amendDelta} onChange={(e) => setAmendDelta(e.target.value)} placeholder={t("contracts.detail.valueChangePlaceholder")} />
            </div>
            <div className="space-y-1">
              <label htmlFor="contract-amend-reason" className="text-xs font-semibold text-neutral-600">{t("common.reason")} <span className="text-red-500">*</span></label>
              <textarea id="contract-amend-reason" className="form-input h-24 resize-none" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setAmendOpen(false)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!amendReason.trim()} onClick={createAmendment}>{t("common.create")}</button>
            </div>
          </div>
        </div>
      )}

      {commentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCommentModal(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{commentModal === "return" ? t("contracts.detail.returnForCorrection") : t("contracts.detail.rejectContract")}</h3>
            <textarea className="form-input h-28 resize-none" placeholder={t("contracts.detail.reasonRequired")} value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCommentModal(null)}>{t("common.cancel")}</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!comment.trim()} onClick={submitComment}>
                {commentModal === "return" ? t("common.return") : t("common.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
