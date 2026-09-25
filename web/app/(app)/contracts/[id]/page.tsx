"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import axios from "axios";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { useToast } from "@/components/ui/Toast";
import { contractsApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import {
  ContractField,
  ContractMoreMenu,
  ContractStatusBadge,
  ContractTabBar,
  contractMenuItemClass,
  formatContractMoney,
} from "@/components/contracts/ContractChrome";

type Tab = "overview" | "deliverables" | "financials" | "clauses" | "amendments" | "lifecycle" | "calloffs" | "documents" | "signatures" | "approvals" | "correspondence" | "audit";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contractId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
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
  const [editing, setEditing] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftDescription, setDraftDescription] = useState("");
  const [draftStart, setDraftStart] = useState("");
  const [draftEnd, setDraftEnd] = useState("");
  const [draftValue, setDraftValue] = useState("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract", contractId] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const act = (fn: () => Promise<unknown>, ok: string) => {
    fn().then(() => { toast.success(ok); refresh(); })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed"));
  };

  const submitMut = useMutation({ mutationFn: () => contractsApi.submit(contractId), onSuccess: () => { toast.success("Submitted for approval"); refresh(); }, onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Submission failed") });

  if (isLoading) return <div className="p-8 text-sm text-neutral-500">{t("contracts.loadingContract")}</div>;
  if (isError || !contract) return <div className="card p-6 text-center text-sm text-red-600">{t("contracts.loadContractError")}</div>;

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
  const canEditDraft = !!user && (isSystemAdmin(user) || hasPermission(user, ["contract.edit_draft", "contract.create"]));
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
      action = () => contractsApi.suspend(contractId, lifecycleReason.trim()); msg = "Contract suspended";
    } else if (lifecycleModal === "terminate") {
      if (!lifecycleReason.trim()) return;
      action = () => contractsApi.terminate(contractId, terminationType, lifecycleReason.trim()); msg = "Contract terminated";
    } else if (lifecycleModal === "extend") {
      if (!lcEndDate || !lifecycleReason.trim()) return;
      action = () => contractsApi.createExtension(contractId, { proposed_end_date: lcEndDate, reason: lifecycleReason.trim() }); msg = "Extension proposed";
    } else if (lifecycleModal === "renew") {
      if (!lcStartDate || !lcEndDate) return;
      action = () => contractsApi.createRenewal(contractId, { new_start_date: lcStartDate, new_end_date: lcEndDate, reason: lifecycleReason.trim() || undefined, procurement_validated: lcProcValidated, budget_confirmed: lcBudgetConfirmed }); msg = "Renewal proposed";
    } else {
      if (!callOffTitle.trim() || !lcStartDate || !lcEndDate || !callOffValue) return;
      action = () => contractsApi.createCallOff(contractId, { title: callOffTitle.trim(), start_date: lcStartDate, end_date: lcEndDate, value: Number(callOffValue) }); msg = "Call-off created";
    }
    act(action, msg);
    setLifecycleModal(null); setLifecycleReason(""); setLcEndDate(""); setLcStartDate(""); setLcProcValidated(false); setLcBudgetConfirmed(false); setCallOffTitle(""); setCallOffValue("");
  };

  const createAmendment = () => {
    contractsApi.createAmendment(contractId, { type: amendType, reason: amendReason.trim(), value_delta: amendDelta ? Number(amendDelta) : undefined })
      .then(() => { toast.success("Amendment created"); setAmendOpen(false); setAmendReason(""); setAmendDelta(""); refresh(); })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
  };

  const openExceptions = (contract.exceptions ?? []).filter((e) => e.status === "open");

  const submitComment = () => {
    if (!commentModal || !comment.trim()) return;
    const action = commentModal === "return"
      ? () => contractsApi.returnForCorrection(contractId, comment.trim())
      : () => contractsApi.rejectWorkflow(contractId, comment.trim());
    act(action, commentModal === "return" ? "Returned for correction" : "Contract rejected");
    setCommentModal(null); setComment("");
  };

  const saveDraft = () => {
    if (!draftTitle.trim() || !draftStart || !draftEnd) return;
    setSavingDraft(true);
    contractsApi.update(contractId, {
      lock_version: contract.lock_version ?? 1,
      title: draftTitle.trim(),
      description: draftDescription.trim() || null,
      start_date: draftStart,
      end_date: draftEnd,
      value: draftValue === "" ? undefined : Number(draftValue),
    })
      .then(() => {
        toast.success(t("contracts.draftSaved"));
        setEditing(false);
        refresh();
      })
      .catch((e: unknown) => {
        const status = axios.isAxiosError(e) ? e.response?.status : undefined;
        if (status === 409) {
          toast.error(t("contracts.conflict"));
          setEditing(false);
          refresh();
          return;
        }
        toast.error(axios.isAxiosError(e) ? (e.response?.data as { message?: string } | undefined)?.message ?? t("contracts.actionFailed") : t("contracts.actionFailed"));
      })
      .finally(() => setSavingDraft(false));
  };

  const tabItems: { id: Tab; label: string }[] = [
    { id: "overview", label: t("contracts.tab.overview") },
    { id: "deliverables", label: t("contracts.tab.deliverables") },
    { id: "financials", label: t("contracts.tab.financials") },
    { id: "clauses", label: t("contracts.tab.clauses") },
    { id: "amendments", label: t("contracts.tab.amendments") },
    { id: "lifecycle", label: t("contracts.tab.lifecycle") },
    ...(contract.is_framework ? [{ id: "calloffs" as Tab, label: t("contracts.tab.calloffs") }] : []),
    { id: "documents", label: t("contracts.tab.documents") },
    { id: "signatures", label: t("contracts.tab.signatures") },
    { id: "approvals", label: t("contracts.tab.approvals") },
    { id: "correspondence", label: t("contracts.tab.correspondence") },
    { id: "audit", label: t("contracts.tab.audit") },
  ];

  const moreItems: ReactNode[] = [];
  if (inReview && canReview) {
    moreItems.push(
      <button key="return" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => { setCommentModal("return"); setComment(""); }}>{t("contracts.actions.return")}</button>,
    );
    if (canReject) {
      moreItems.push(
        <button key="reject" type="button" role="menuitem" className={contractMenuItemClass(true)} onClick={() => { setCommentModal("reject"); setComment(""); }}>{t("contracts.actions.reject")}</button>,
      );
    }
  }
  if (inReview && canSubmit) {
    moreItems.push(
      <button key="withdraw" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => act(() => contractsApi.withdraw(contractId), "Withdrawn")}>{t("contracts.actions.withdraw")}</button>,
    );
  }
  if (isExecuted && canAmend) {
    moreItems.push(
      <button key="amend" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => setAmendOpen(true)}>{t("contracts.actions.amend")}</button>,
    );
  }
  if (isExecuted && canClose) {
    moreItems.push(
      <button key="close" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => act(() => contractsApi.close(contractId), "Contract closed")}>{t("contracts.actions.close")}</button>,
    );
  }
  if (isActiveLifecycle && canSuspend) {
    moreItems.push(
      <button key="suspend" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => { setLifecycleModal("suspend"); setLifecycleReason(""); }}>{t("contracts.actions.suspend")}</button>,
    );
  }
  if (isActiveLifecycle && canAmend) {
    moreItems.push(
      <button key="extend" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => { setLifecycleModal("extend"); setLifecycleReason(""); setLcEndDate(""); }}>{t("contracts.actions.extend")}</button>,
    );
  }
  if (isActiveLifecycle && canAmend && contract.renewal_type && contract.renewal_type !== "non_renewable") {
    moreItems.push(
      <button key="renew" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => { setLifecycleModal("renew"); setLifecycleReason(""); setLcStartDate(""); setLcEndDate(""); }}>{t("contracts.actions.renew")}</button>,
    );
  }
  if ((isExecuted || isSuspended) && canTerminate) {
    moreItems.push(
      <button key="terminate" type="button" role="menuitem" className={contractMenuItemClass(true)} onClick={() => { setLifecycleModal("terminate"); setLifecycleReason(""); }}>{t("contracts.actions.terminate")}</button>,
    );
  }
  if (isExecuted && canAcceptDeliverable && contract.vendor_id) {
    moreItems.push(
      <button key="rate" type="button" role="menuitem" className={contractMenuItemClass()} onClick={() => setPerfOpen(true)}>{t("contracts.actions.rate")}</button>,
    );
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={contract.title}
        subtitle={`${contract.reference_number} · ${contract.display_counterparty ?? contract.vendor?.name ?? "—"}`}
        breadcrumbs={<PageBreadcrumbs items={[{ label: "contracts.title", href: "/contracts" }, { label: "contracts.register", href: "/contracts/register" }, { label: contract.reference_number }]} />}
        meta={<ContractStatusBadge status={lifecycle} />}
        actions={
          <>
            {isDraft && canEditDraft && !editing && (
              <button type="button" className="btn-secondary text-sm" onClick={() => {
                setDraftTitle(contract.title);
                setDraftDescription(contract.description ?? "");
                setDraftStart((contract.start_date ?? "").slice(0, 10));
                setDraftEnd((contract.end_date ?? "").slice(0, 10));
                setDraftValue(String(contract.current_value ?? contract.value ?? ""));
                setEditing(true);
                setTab("overview");
              }}>
                {t("contracts.editDraft")}
              </button>
            )}
            {isDraft && canSubmit && (
              <button type="button" className="btn-primary text-sm disabled:opacity-60" disabled={submitMut.isPending || (readiness && !readiness.ready)} onClick={() => submitMut.mutate()}>
                {t("contracts.actions.submit")}
              </button>
            )}
            {inReview && canReview && (
              <button type="button" className="btn-primary text-sm" onClick={() => act(() => contractsApi.approveWorkflow(contractId), "Approval recorded")}>{t("contracts.actions.approve")}</button>
            )}
            {readyForSignature && canSend && (
              <button type="button" className="btn-primary text-sm" onClick={() => act(() => contractsApi.sendForSignature(contractId), "Sent for signature")}>{t("contracts.actions.send")}</button>
            )}
            {inSignature && canSign && !sadcSigned && (
              <button type="button" className="btn-primary text-sm" onClick={() => act(() => contractsApi.signInternal(contractId), "Signature recorded")}>{t("contracts.actions.sign")}</button>
            )}
            {isSuspended && canSuspend && (
              <button type="button" className="btn-primary text-sm" onClick={() => act(() => contractsApi.resume(contractId), "Contract resumed")}>{t("contracts.actions.resume")}</button>
            )}
            <a href={contractsApi.packDownloadUrl(contractId)} className="btn-secondary text-sm inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]" aria-hidden="true">inventory_2</span>
              {t("contracts.actions.pack")}
            </a>
            {moreItems.length > 0 && <ContractMoreMenu>{moreItems}</ContractMoreMenu>}
          </>
        }
      />

      {openExceptions.length > 0 && (
        <div className="space-y-2">
          {openExceptions.map((e) => (
            <div key={e.id} className={`rounded-lg border px-4 py-2 text-sm ${e.severity === "critical" ? "bg-red-50 border-red-200 text-red-700" : e.severity === "high" ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-amber-50 border-amber-200 text-amber-700"}`}>
              <span className="font-semibold uppercase text-[10px] mr-2">{e.severity}</span>{e.title}
            </div>
          ))}
        </div>
      )}

      <ContractTabBar tabs={tabItems} active={tab} onChange={setTab} />

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">{t("contracts.overview.facts")}</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">{t("contracts.overview.type")}</dt><dd className="text-neutral-900">{contract.type?.name ?? "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.overview.origin")}</dt>
              <dd className="text-neutral-900">
                {contract.programme ? (
                  <Link href={`/pif/${contract.programme.id}`} className="text-primary hover:underline">
                    {contract.programme.reference_number} · {contract.programme.title}
                  </Link>
                ) : (
                  <span className="capitalize">{contract.origin_type ?? "—"}</span>
                )}
              </dd>
              <dt className="text-neutral-500">{t("contracts.overview.value")}</dt><dd className="text-neutral-900 font-semibold">{formatContractMoney(contract.currency, contract.current_value ?? contract.value)}</dd>
              {contract.budget_currency && (<><dt className="text-neutral-500">{t("contracts.overview.budgetCurrency")}</dt><dd className="text-neutral-900">{contract.budget_currency}{contract.converted_value != null ? ` · ${Number(contract.converted_value).toLocaleString()}` : ""}{contract.conversion_reference ? ` (${contract.conversion_reference})` : ""}</dd></>)}
              <dt className="text-neutral-500">{t("contracts.overview.start")}</dt><dd className="text-neutral-900">{contract.start_date ? formatDateShort(contract.start_date) : "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.overview.end")}</dt><dd className="text-neutral-900">{contract.end_date ? formatDateShort(contract.end_date) : "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.overview.signature")}</dt><dd className="text-neutral-900">{contract.signature_status ?? "—"}</dd>
              <dt className="text-neutral-500">{t("contracts.overview.health")}</dt><dd className="text-neutral-900 capitalize">{contract.health_status ?? "normal"}</dd>
            </dl>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">{t("contracts.overview.readiness")}</h3>
            {readiness ? (
              <ul className="space-y-1.5 text-sm">
                {readiness.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${c.passed ? "text-green-600" : c.blocking ? "text-red-600" : "text-amber-600"}`} aria-hidden="true">
                      {c.passed ? "check_circle" : "cancel"}
                    </span>
                    <span className={c.passed ? "text-neutral-700" : "text-neutral-900"}>{c.label}{!c.blocking && !c.passed ? ` ${t("contracts.overview.optional")}` : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-400">{t("contracts.loading")}</p>}
          </div>
          {editing && canEditDraft && (
            <form
              className="card p-5 space-y-4 md:col-span-2"
              onSubmit={(ev) => { ev.preventDefault(); saveDraft(); }}
            >
              <h3 className="text-sm font-semibold text-neutral-800">{t("contracts.editDraft")}</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <ContractField label={t("contracts.field.title")} htmlFor="draft-title" className="sm:col-span-2">
                  <input id="draft-title" className="form-input" value={draftTitle} onChange={(e) => setDraftTitle(e.target.value)} required />
                </ContractField>
                <ContractField label={t("contracts.field.description")} htmlFor="draft-description" className="sm:col-span-2">
                  <textarea id="draft-description" className="form-input min-h-[5rem]" value={draftDescription} onChange={(e) => setDraftDescription(e.target.value)} />
                </ContractField>
                <ContractField label={t("contracts.field.startDate")} htmlFor="draft-start">
                  <input id="draft-start" type="date" className="form-input" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} required />
                </ContractField>
                <ContractField label={t("contracts.field.endDate")} htmlFor="draft-end">
                  <input id="draft-end" type="date" className="form-input" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} required />
                </ContractField>
                <ContractField label={t("contracts.field.value")} htmlFor="draft-value">
                  <input id="draft-value" type="number" min={0} step="0.01" className="form-input" value={draftValue} onChange={(e) => setDraftValue(e.target.value)} />
                </ContractField>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="submit" className="btn-primary text-sm disabled:opacity-60" disabled={savingDraft}>
                  {t("contracts.saveDraft")}
                </button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setEditing(false)}>
                  {t("common.cancel")}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {tab === "deliverables" && (
        <div className="card overflow-x-auto">
          {(contract.deliverables ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No deliverables recorded.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>#</th><th>Deliverable</th><th>Responsible</th><th>Due</th><th>Status</th><th></th></tr></thead>
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
                          <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.reviewDeliverable(contractId, d.id, "accept"), "Deliverable accepted")}>Accept</button>
                          <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => act(() => contractsApi.reviewDeliverable(contractId, d.id, "reject"), "Deliverable rejected")}>Reject</button>
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
                ["Original value", ledgerData.ledger.original],
                ["Current value", ledgerData.ledger.current],
                ["Ceiling", ledgerData.ledger.ceiling],
                ["Paid", ledgerData.ledger.paid],
                ["Approved unpaid", ledgerData.ledger.approved_unpaid],
                ["Remaining", ledgerData.ledger.remaining],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="card p-4">
                  <p className="text-2xl font-bold text-neutral-900">{ledgerData.ledger.currency} {Number(val).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          ) : <div className="card p-6 text-sm text-neutral-500">Loading ledger…</div>}
          {ledgerData && ledgerData.schedules.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Milestone</th><th>Basis</th><th className="text-right">Amount</th><th>Status</th></tr></thead>
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
          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Linked invoices</div>
            {(invoiceData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No invoices linked to this contract.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Invoice</th><th>Milestone</th><th>Deliverable</th><th className="text-right">Amount</th><th>Due</th><th>Status</th></tr></thead>
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
          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Assigned clauses</div>
            {(clauseData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No clauses assigned.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Clause</th><th>Type</th><th>Deviation</th><th></th></tr></thead>
                <tbody>
                  {(clauseData ?? []).map((a) => (
                    <tr key={a.id}>
                      <td className="text-sm font-medium text-neutral-800">{a.clause?.title ?? a.clause?.key}</td>
                      <td className="text-xs capitalize text-neutral-500">{(a.clause?.clause_type ?? "").replace(/_/g, " ")}</td>
                      <td className="text-sm">{a.is_deviation ? <span className="badge badge-warning">Deviation ({a.deviation_status})</span> : "—"}</td>
                      <td className="text-right">
                        {canAmend && (
                          <button className="btn-secondary text-xs py-0.5 text-red-600" onClick={() => act(() => contractsApi.unassignClause(contractId, a.id), "Clause removed")}>Remove</button>
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
              <p className="text-xs font-semibold text-neutral-600 mb-2">Add a clause from the library</p>
              <div className="flex flex-wrap gap-2">
                {(clauseLibrary ?? []).filter((lib) => !(clauseData ?? []).some((a) => a.clause_id === lib.id)).map((lib) => (
                  <button key={lib.id} className="btn-secondary text-xs" onClick={() => act(() => contractsApi.assignClause(contractId, lib.id), "Clause assigned")}>
                    + {lib.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "amendments" && (
        <div className="card overflow-x-auto">
          {(contract.amendments ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No amendments.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Reference</th><th>Type</th><th className="text-right">Δ Value</th><th className="text-right">Revised</th><th>Material</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {(contract.amendments ?? []).map((a) => (
                  <tr key={a.id}>
                    <td className="font-mono text-xs text-neutral-700">{a.reference_number}</td>
                    <td className="text-sm capitalize">{a.type}</td>
                    <td className="text-right text-sm">{a.value_delta != null ? Number(a.value_delta).toLocaleString() : "—"}</td>
                    <td className="text-right text-sm font-semibold">{a.revised_value != null ? Number(a.revised_value).toLocaleString() : "—"}</td>
                    <td className="text-sm">{a.is_material ? "Yes" : "No"}</td>
                    <td className="text-sm capitalize">{a.status}</td>
                    <td className="text-right">
                      {canApproveAmendment && a.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveAmendment(contractId, a.id), "Amendment approved")}>Approve</button>
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
            Renewal type: <span className="font-medium text-neutral-900">{contract.renewal_type ? contract.renewal_type.replace(/_/g, " ") : "not set"}</span>
            {contract.auto_renew && <span className="ml-2 badge badge-warning">Auto-renews</span>}
            <span className="ml-2 text-neutral-500">· Renewals: {contract.renewals_count ?? 0}</span>
          </div>
          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Extensions</div>
            {(contract.extensions ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No extensions.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Proposed end</th><th>Reason</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(contract.extensions ?? []).map((e) => (
                    <tr key={e.id}>
                      <td className="text-sm">{e.proposed_end_date ? formatDateShort(e.proposed_end_date) : "—"}</td>
                      <td className="text-sm text-neutral-700">{e.reason}</td>
                      <td className="text-sm capitalize">{e.status}</td>
                      <td className="text-right">{canApproveAmendment && e.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveExtension(contractId, e.id), "Extension approved")}>Approve</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 text-sm font-semibold text-neutral-800">Renewals</div>
            {(contract.renewals ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No renewals.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>#</th><th>New period</th><th>Procurement</th><th>Budget</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(contract.renewals ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="text-sm">{r.renewal_number}</td>
                      <td className="text-sm">{formatDateShort(r.new_start_date)} → {formatDateShort(r.new_end_date)}</td>
                      <td className="text-sm">{r.procurement_validated ? "✓" : "—"}</td>
                      <td className="text-sm">{r.budget_confirmed ? "✓" : "—"}</td>
                      <td className="text-sm capitalize">{r.status}</td>
                      <td className="text-right">{canApproveAmendment && r.status === "pending" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => act(() => contractsApi.approveRenewal(contractId, r.id), "Renewal approved")}>Approve</button>
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
                <div key={`s${s.id}`} className="text-neutral-600"><span className="badge badge-muted mr-2">Suspension</span>{s.reason} — {s.status}</div>
              ))}
              {(contract.terminations ?? []).map((t) => (
                <div key={`t${t.id}`} className="text-neutral-600"><span className="badge badge-danger mr-2">Termination ({t.type})</span>{t.reason}</div>
              ))}
            </div>
          )}

          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">Key personnel</span>
              <button className="btn-secondary text-xs" onClick={() => setPersonOpen(true)}>Add personnel</button>
            </div>
            {(personnelData?.personnel ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No key personnel recorded.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Name</th><th>Role</th><th>CV ref</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(personnelData?.personnel ?? []).map((p) => (
                    <tr key={p.id}>
                      <td className="text-sm text-neutral-800">{p.name}</td>
                      <td className="text-sm text-neutral-600">{p.role}</td>
                      <td className="text-xs text-neutral-500">{p.cv_reference ?? "—"}</td>
                      <td className="text-xs capitalize">{p.status}</td>
                      <td className="text-right">{p.status === "active" && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => {
                          const proposed_name = window.prompt("Replacement name:");
                          if (!proposed_name) return;
                          const reason = window.prompt("Reason for replacement:") ?? "";
                          contractsApi.requestPersonnelReplacement(contractId, p.id, { proposed_name, proposed_role: p.role, reason })
                            .then(() => { toast.success("Replacement requested (pending approval)"); refreshPersonnel(); })
                            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
                        }}>Request replacement</button>
                      )}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {(personnelData?.pending_replacements ?? []).length > 0 && (
              <div className="p-4 border-t border-neutral-100 space-y-2">
                <p className="text-xs font-semibold text-neutral-600">Pending replacements</p>
                {(personnelData?.pending_replacements ?? []).map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-neutral-700">→ {r.proposed_name} ({r.proposed_role}) — {r.reason}</span>
                    {canApproveAmendment && (
                      <span className="flex gap-2">
                        <button className="btn-secondary text-xs py-0.5" onClick={() => contractsApi.approvePersonnelReplacement(contractId, r.id).then(() => { toast.success("Replacement approved"); refreshPersonnel(); }).catch(() => toast.error("Failed"))}>Approve</button>
                        <button className="btn-secondary text-xs py-0.5" onClick={() => contractsApi.rejectPersonnelReplacement(contractId, r.id).then(() => { toast.success("Replacement rejected"); refreshPersonnel(); }).catch(() => toast.error("Failed"))}>Reject</button>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">Disputes</span>
              <button className="btn-secondary text-xs" onClick={() => setDisputeOpen(true)}>Raise dispute</button>
            </div>
            {(disputeData ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No disputes recorded.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Raised</th><th>Type</th><th>Description</th><th>At risk</th><th>Legal</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {(disputeData ?? []).map((d) => (
                    <tr key={d.id}>
                      <td className="text-sm whitespace-nowrap">{d.date_raised ? formatDateShort(d.date_raised) : "—"}</td>
                      <td className="text-xs capitalize">{d.type}</td>
                      <td className="text-sm text-neutral-700 max-w-[16rem] truncate">{d.description}</td>
                      <td className="text-sm">{d.amount_at_risk != null ? Number(d.amount_at_risk).toLocaleString() : "—"}</td>
                      <td className="text-sm">{d.legal_involved ? "Yes" : "—"}</td>
                      <td className="text-xs capitalize">{d.status.replace(/_/g, " ")}</td>
                      <td className="text-right">{!["resolved", "closed"].includes(d.status) && (
                        <button className="btn-secondary text-xs py-0.5" onClick={() => {
                          const resolution = window.prompt("Resolution note:");
                          if (resolution === null) return;
                          contractsApi.updateDispute(contractId, d.id, { status: "resolved", resolution })
                            .then(() => { toast.success("Dispute resolved"); qc.invalidateQueries({ queryKey: ["contract", contractId, "disputes"] }); })
                            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
                        }}>Resolve</button>
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
                ["Ceiling", callOffData.utilisation.ceiling],
                ["Used", callOffData.utilisation.used],
                ["Remaining", callOffData.utilisation.remaining],
              ] as [string, number][]).map(([label, val]) => (
                <div key={label} className="card p-4">
                  <p className="text-2xl font-bold text-neutral-900">{callOffData.utilisation!.currency} {Number(val).toLocaleString()}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
                </div>
              ))}
              <div className="card p-4">
                <p className="text-2xl font-bold text-neutral-900">{callOffData.utilisation.call_off_count}</p>
                <p className="text-xs text-neutral-500 mt-0.5">Call-offs</p>
              </div>
            </div>
          )}
          <div className="card overflow-x-auto">
            <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
              <span className="text-sm font-semibold text-neutral-800">Call-offs</span>
              {canAmend && (
                <button className="btn-secondary text-xs" onClick={() => { setLifecycleModal("calloff"); setLifecycleReason(""); setLcStartDate(""); setLcEndDate(""); setCallOffTitle(""); setCallOffValue(""); }}>New call-off</button>
              )}
            </div>
            {(callOffData?.data ?? []).length === 0 ? (
              <div className="p-4 text-sm text-neutral-500">No call-offs issued under this framework.</div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Reference</th><th>Title</th><th className="text-right">Value</th><th>Ends</th><th>Status</th></tr></thead>
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
            .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Compare failed"));
        };
        return (
        <div className="space-y-4">
        <div className="card overflow-x-auto">
          {(contract.document_versions ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No generated documents yet.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Version</th><th>Kind</th><th>Hash</th><th>Generated</th><th>Locked</th></tr></thead>
              <tbody>
                {(contract.document_versions ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">v{d.version}</td>
                    <td className="text-sm capitalize">{d.kind}</td>
                    <td className="font-mono text-[11px] text-neutral-500">{d.hash ? `${d.hash.slice(0, 16)}…` : "—"}</td>
                    <td className="text-sm text-neutral-500">{d.generated_at ? formatDateShort(d.generated_at) : "—"}</td>
                    <td className="text-sm">{d.is_locked ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {workingVersions.length >= 2 && (
          <div className="card p-4 space-y-3">
            <p className="text-sm font-semibold text-neutral-800">Compare working drafts (redline)</p>
            <div className="flex flex-wrap items-center gap-2">
              <select className="form-input w-auto" value={cmpFrom} onChange={(e) => setCmpFrom(e.target.value ? Number(e.target.value) : "")}>
                <option value="">From version…</option>
                {workingVersions.map((d) => <option key={d.id} value={d.id}>v{d.version}</option>)}
              </select>
              <span className="text-neutral-400">→</span>
              <select className="form-input w-auto" value={cmpTo} onChange={(e) => setCmpTo(e.target.value ? Number(e.target.value) : "")}>
                <option value="">To version…</option>
                {workingVersions.map((d) => <option key={d.id} value={d.id}>v{d.version}</option>)}
              </select>
              <button className="btn-secondary text-sm" disabled={!cmpFrom || !cmpTo || cmpFrom === cmpTo} onClick={runCompare}>Compare</button>
            </div>
            {cmpResult && (
              <div className="space-y-2">
                <p className="text-xs text-neutral-500">{cmpResult.added} added · {cmpResult.removed} removed</p>
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
        <div className="card overflow-x-auto">
          {(contract.signatories ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">Not yet sent for signature.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>Order</th><th>Party</th><th>Signatory</th><th>Method</th><th>Status</th><th>Signed</th></tr></thead>
              <tbody>
                {[...(contract.signatories ?? [])].sort((a, b) => a.sign_order - b.sign_order).map((s) => (
                  <tr key={s.id}>
                    <td className="text-sm">{s.sign_order}</td>
                    <td className="text-sm capitalize">{s.party === "sadcpf" ? "SADC PF" : "Counterparty"}</td>
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
            <p className="text-sm text-neutral-500">This contract has not been submitted for approval yet.</p>
          )}
        </div>
      )}

      {tab === "correspondence" && (
        <div className="card overflow-x-auto">
          <div className="px-4 py-2 border-b border-neutral-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-neutral-800">Linked correspondence</span>
            <button className="btn-secondary text-xs" onClick={() => setCorrOpen(true)}>Create correspondence</button>
          </div>
          {(correspondenceData ?? []).length === 0 ? (
            <p className="p-6 text-sm text-neutral-400">No correspondence linked to this contract yet.</p>
          ) : (
            <table className="data-table">
              <thead><tr><th>Reference</th><th>Title</th><th>Type</th><th>Direction</th><th>Status</th><th>Created</th></tr></thead>
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
        <div className="card overflow-x-auto">
          {(auditData ?? []).length === 0 ? (
            <div className="p-6 text-sm text-neutral-500">No audit events yet.</div>
          ) : (
            <table className="data-table">
              <thead><tr><th>When</th><th>Event</th></tr></thead>
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
            <h3 className="text-base font-bold text-neutral-900">Add key personnel</h3>
            <input className="form-input" placeholder="Name" value={person.name} onChange={(e) => setPerson((p) => ({ ...p, name: e.target.value }))} />
            <input className="form-input" placeholder="Role" value={person.role} onChange={(e) => setPerson((p) => ({ ...p, role: e.target.value }))} />
            <input className="form-input" placeholder="Email (optional)" value={person.email} onChange={(e) => setPerson((p) => ({ ...p, email: e.target.value }))} />
            <input className="form-input" placeholder="CV reference (optional)" value={person.cv_reference} onChange={(e) => setPerson((p) => ({ ...p, cv_reference: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPersonOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!person.name.trim() || !person.role.trim()}
                onClick={() => {
                  contractsApi.addKeyPersonnel(contractId, { name: person.name, role: person.role, email: person.email || undefined, cv_reference: person.cv_reference || undefined })
                    .then(() => { toast.success("Key personnel added"); setPersonOpen(false); setPerson({ name: "", role: "", email: "", cv_reference: "" }); refreshPersonnel(); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
                }}>Add</button>
            </div>
          </div>
        </div>
      )}

      {disputeOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDisputeOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">Raise dispute</h3>
            <select className="form-input" value={dispute.type} onChange={(e) => setDispute((p) => ({ ...p, type: e.target.value }))}>
              {["payment", "performance", "scope", "delay", "quality", "other"].map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
            </select>
            <textarea className="form-input h-24 resize-none" placeholder="Description" value={dispute.description} onChange={(e) => setDispute((p) => ({ ...p, description: e.target.value }))} />
            <input className="form-input" type="number" placeholder="Amount at risk (optional)" value={dispute.amount_at_risk} onChange={(e) => setDispute((p) => ({ ...p, amount_at_risk: e.target.value }))} />
            <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={dispute.legal_involved} onChange={(e) => setDispute((p) => ({ ...p, legal_involved: e.target.checked }))} /> Legal involved</label>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setDisputeOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!dispute.description.trim()}
                onClick={() => {
                  contractsApi.createDispute(contractId, {
                    type: dispute.type, description: dispute.description, legal_involved: dispute.legal_involved,
                    amount_at_risk: dispute.amount_at_risk ? Number(dispute.amount_at_risk) : undefined,
                  }).then(() => { toast.success("Dispute recorded"); setDisputeOpen(false); setDispute({ type: "performance", description: "", amount_at_risk: "", legal_involved: false }); qc.invalidateQueries({ queryKey: ["contract", contractId, "disputes"] }); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
                }}>Raise</button>
            </div>
          </div>
        </div>
      )}

      {corrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCorrOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">Create correspondence</h3>
            <p className="text-xs text-neutral-500">Creates a draft in the Correspondence Register linked to this contract.</p>
            <input className="form-input" placeholder="Title" value={corr.title} onChange={(e) => setCorr((p) => ({ ...p, title: e.target.value }))} />
            <input className="form-input" placeholder="Subject" value={corr.subject} onChange={(e) => setCorr((p) => ({ ...p, subject: e.target.value }))} />
            <select className="form-input" value={corr.type} onChange={(e) => setCorr((p) => ({ ...p, type: e.target.value }))}>
              <option value="procurement">Procurement</option>
              <option value="external">External</option>
              <option value="internal_memo">Internal memo</option>
              <option value="diplomatic_note">Diplomatic note</option>
            </select>
            <textarea className="form-input h-24 resize-none" placeholder="Body (optional)" value={corr.body} onChange={(e) => setCorr((p) => ({ ...p, body: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCorrOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" disabled={!corr.title.trim() || !corr.subject.trim()}
                onClick={() => {
                  contractsApi.createCorrespondence(contractId, corr)
                    .then(() => { toast.success("Correspondence draft created"); setCorrOpen(false); setCorr({ title: "", subject: "", body: "", type: "procurement" }); qc.invalidateQueries({ queryKey: ["contract", contractId, "correspondence"] }); })
                    .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed"));
                }}>Create</button>
            </div>
          </div>
        </div>
      )}

      {perfOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPerfOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">Rate supplier performance</h3>
            {([
              ["delivery_score", "Delivery / timeliness"], ["quality_score", "Quality"], ["price_score", "Value for money"],
              ["compliance_score", "Compliance"], ["communication_score", "Communication"],
            ] as [keyof typeof perf, string][]).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <label className="text-sm text-neutral-700">{label}</label>
                <select className="form-input w-24" value={perf[key] as number} onChange={(e) => setPerf((p) => ({ ...p, [key]: Number(e.target.value) }))}>
                  {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
            ))}
            <textarea className="form-input h-20 resize-none" placeholder="Notes (required for poor ratings)" value={perf.notes} onChange={(e) => setPerf((p) => ({ ...p, notes: e.target.value }))} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setPerfOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={() => { act(() => contractsApi.submitPerformanceReview(contractId, perf), "Supplier performance recorded"); setPerfOpen(false); }}>Save rating</button>
            </div>
          </div>
        </div>
      )}

      {lifecycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLifecycleModal(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900 capitalize">{lifecycleModal} contract</h3>
            {lifecycleModal === "terminate" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Termination type</label>
                <select className="form-input" value={terminationType} onChange={(e) => setTerminationType(e.target.value)}>
                  {["convenience", "cause", "mutual", "force_majeure", "other"].map((t) => (
                    <option key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</option>
                  ))}
                </select>
              </div>
            )}
            {lifecycleModal === "calloff" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Call-off title <span className="text-red-500">*</span></label>
                <input className="form-input" value={callOffTitle} onChange={(e) => setCallOffTitle(e.target.value)} />
                <label className="text-xs font-semibold text-neutral-600 mt-2 block">Value <span className="text-red-500">*</span></label>
                <input type="number" min="0" step="0.01" className="form-input" value={callOffValue} onChange={(e) => setCallOffValue(e.target.value)} />
              </div>
            )}
            {(lifecycleModal === "renew" || lifecycleModal === "calloff") && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{lifecycleModal === "calloff" ? "Start date" : "New start date"} <span className="text-red-500">*</span></label>
                <input type="date" className="form-input" value={lcStartDate} onChange={(e) => setLcStartDate(e.target.value)} />
              </div>
            )}
            {(lifecycleModal === "extend" || lifecycleModal === "renew" || lifecycleModal === "calloff") && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">{lifecycleModal === "extend" ? "Proposed end date" : "End date"} <span className="text-red-500">*</span></label>
                <input type="date" className="form-input" value={lcEndDate} onChange={(e) => setLcEndDate(e.target.value)} />
              </div>
            )}
            {lifecycleModal === "renew" && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={lcProcValidated} onChange={(e) => setLcProcValidated(e.target.checked)} /> Procurement validated</label>
                <label className="flex items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={lcBudgetConfirmed} onChange={(e) => setLcBudgetConfirmed(e.target.checked)} /> Budget confirmed</label>
              </div>
            )}
            {lifecycleModal !== "calloff" && (
              <div className="space-y-1">
                <label className="text-xs font-semibold text-neutral-600">Reason {!["renew"].includes(lifecycleModal) && <span className="text-red-500">*</span>}</label>
                <textarea className="form-input h-20 resize-none" value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} />
              </div>
            )}
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setLifecycleModal(null)}>Cancel</button>
              <button className="btn-primary flex-1 capitalize" onClick={runLifecycle}>{lifecycleModal}</button>
            </div>
          </div>
        </div>
      )}

      {amendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setAmendOpen(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">Create amendment</h3>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Type</label>
              <select className="form-input" value={amendType} onChange={(e) => setAmendType(e.target.value)}>
                {["value", "duration", "scope", "deliverables", "key_personnel", "funding", "administrative", "other"].map((t) => (
                  <option key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Value change (±, optional)</label>
              <input type="number" step="0.01" className="form-input" value={amendDelta} onChange={(e) => setAmendDelta(e.target.value)} placeholder="e.g. 2000 or -500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Reason <span className="text-red-500">*</span></label>
              <textarea className="form-input h-24 resize-none" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setAmendOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!amendReason.trim()} onClick={createAmendment}>Create</button>
            </div>
          </div>
        </div>
      )}

      {commentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCommentModal(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{commentModal === "return" ? "Return for correction" : "Reject contract"}</h3>
            <textarea className="form-input h-28 resize-none" placeholder="Reason (required)…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setCommentModal(null)}>Cancel</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!comment.trim()} onClick={submitComment}>
                {commentModal === "return" ? "Return" : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
