"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { ApprovalTimeline } from "@/components/workflow/ApprovalTimeline";
import { useToast } from "@/components/ui/Toast";
import { contractsApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

const LIFECYCLE_BADGES: Record<string, string> = {
  DRAFT: "badge-muted", IN_REVIEW: "badge-warning", CHANGES_REQUESTED: "badge-warning",
  APPROVAL_PENDING: "badge-warning", APPROVED_FOR_SIGNATURE: "badge-primary",
  SENT_FOR_SIGNATURE: "badge-primary", PARTIALLY_SIGNED: "badge-primary",
  FULLY_EXECUTED: "badge-success", ACTIVE: "badge-success", COMPLETED: "badge-primary",
  CLOSING: "badge-muted", CLOSED: "badge-muted", REJECTED: "badge-danger",
  TERMINATED: "badge-danger", EXPIRED: "badge-danger",
};

type Tab = "overview" | "deliverables" | "financials" | "amendments" | "documents" | "signatures" | "approvals" | "audit";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contractId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();

  const [tab, setTab] = useState<Tab>("overview");
  const [commentModal, setCommentModal] = useState<null | "return" | "reject">(null);
  const [comment, setComment] = useState("");
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendType, setAmendType] = useState("value");
  const [amendReason, setAmendReason] = useState("");
  const [amendDelta, setAmendDelta] = useState("");
  const [lifecycleModal, setLifecycleModal] = useState<null | "suspend" | "terminate">(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [terminationType, setTerminationType] = useState("convenience");

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

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["contract", contractId] });
    qc.invalidateQueries({ queryKey: ["contracts"] });
  };

  const act = (fn: () => Promise<unknown>, ok: string) => {
    fn().then(() => { toast.success(ok); refresh(); })
      .catch((e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Action failed"));
  };

  const submitMut = useMutation({ mutationFn: () => contractsApi.submit(contractId), onSuccess: () => { toast.success("Submitted for approval"); refresh(); }, onError: (e: unknown) => toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Submission failed") });

  if (isLoading) return <div className="p-8 text-sm text-neutral-500">Loading contract…</div>;
  if (isError || !contract) return <div className="card p-6 text-center text-sm text-red-600">Failed to load contract.</div>;

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
    if (!lifecycleModal || !lifecycleReason.trim()) return;
    const action = lifecycleModal === "suspend"
      ? () => contractsApi.suspend(contractId, lifecycleReason.trim())
      : () => contractsApi.terminate(contractId, terminationType, lifecycleReason.trim());
    act(action, lifecycleModal === "suspend" ? "Contract suspended" : "Contract terminated");
    setLifecycleModal(null); setLifecycleReason("");
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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
          title={contract.title}
          subtitle={`${contract.reference_number} · ${contract.display_counterparty ?? contract.vendor?.name ?? "—"}`}
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Contracts", href: "/contracts" }, { label: "Register", href: "/contracts/register" }, { label: contract.reference_number }]} />}
        />
        <div className="flex flex-wrap items-center gap-2">
          <span className={`badge ${LIFECYCLE_BADGES[lifecycle] ?? "badge-muted"}`}>{lifecycle.replace(/_/g, " ")}</span>
          {isDraft && canSubmit && (
            <button className="btn-primary text-sm disabled:opacity-60" disabled={submitMut.isPending || (readiness && !readiness.ready)} onClick={() => submitMut.mutate()}>
              Submit for approval
            </button>
          )}
          {inReview && canReview && (
            <>
              <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.approveWorkflow(contractId), "Approval recorded")}>Approve</button>
              <button className="btn-secondary text-sm" onClick={() => { setCommentModal("return"); setComment(""); }}>Return</button>
              {canReject && <button className="btn-secondary text-sm text-red-600" onClick={() => { setCommentModal("reject"); setComment(""); }}>Reject</button>}
            </>
          )}
          {inReview && canSubmit && (
            <button className="btn-secondary text-sm" onClick={() => act(() => contractsApi.withdraw(contractId), "Withdrawn")}>Withdraw</button>
          )}
          {readyForSignature && canSend && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.sendForSignature(contractId), "Sent for signature")}>Send for signature</button>
          )}
          {inSignature && canSign && !sadcSigned && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.signInternal(contractId), "Signature recorded")}>Sign (SADC PF)</button>
          )}
          {isExecuted && canAmend && (
            <button className="btn-secondary text-sm" onClick={() => setAmendOpen(true)}>Amend</button>
          )}
          {isExecuted && canClose && (
            <button className="btn-secondary text-sm" onClick={() => act(() => contractsApi.close(contractId), "Contract closed")}>Close out</button>
          )}
          {isActiveLifecycle && canSuspend && (
            <button className="btn-secondary text-sm" onClick={() => { setLifecycleModal("suspend"); setLifecycleReason(""); }}>Suspend</button>
          )}
          {isSuspended && canSuspend && (
            <button className="btn-primary text-sm" onClick={() => act(() => contractsApi.resume(contractId), "Contract resumed")}>Resume</button>
          )}
          {(isExecuted || isSuspended) && canTerminate && (
            <button className="btn-secondary text-sm text-red-600" onClick={() => { setLifecycleModal("terminate"); setLifecycleReason(""); }}>Terminate</button>
          )}
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
        {(["overview", "deliverables", "financials", "amendments", "documents", "signatures", "approvals", "audit"] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${tab === t ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">Key facts</h3>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-neutral-500">Type</dt><dd className="text-neutral-900">{contract.type?.name ?? "—"}</dd>
              <dt className="text-neutral-500">Origin</dt><dd className="text-neutral-900 capitalize">{contract.origin_type ?? "—"}</dd>
              <dt className="text-neutral-500">Value</dt><dd className="text-neutral-900 font-semibold">{contract.currency} {Number(contract.current_value ?? contract.value).toLocaleString()}</dd>
              <dt className="text-neutral-500">Start</dt><dd className="text-neutral-900">{contract.start_date ? formatDateShort(contract.start_date) : "—"}</dd>
              <dt className="text-neutral-500">End</dt><dd className="text-neutral-900">{contract.end_date ? formatDateShort(contract.end_date) : "—"}</dd>
              <dt className="text-neutral-500">Signature</dt><dd className="text-neutral-900">{contract.signature_status ?? "—"}</dd>
              <dt className="text-neutral-500">Health</dt><dd className="text-neutral-900 capitalize">{contract.health_status ?? "normal"}</dd>
            </dl>
          </div>
          <div className="card p-5 space-y-3">
            <h3 className="text-sm font-semibold text-neutral-800">Readiness</h3>
            {readiness ? (
              <ul className="space-y-1.5 text-sm">
                {readiness.checks.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className={`material-symbols-outlined text-[18px] ${c.passed ? "text-green-600" : c.blocking ? "text-red-600" : "text-amber-600"}`}>
                      {c.passed ? "check_circle" : "cancel"}
                    </span>
                    <span className={c.passed ? "text-neutral-700" : "text-neutral-900"}>{c.label}{!c.blocking && !c.passed ? " (optional)" : ""}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-neutral-400">Loading…</p>}
          </div>
        </div>
      )}

      {tab === "deliverables" && (
        <div className="card overflow-hidden">
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
            <div className="card overflow-hidden">
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
        </div>
      )}

      {tab === "amendments" && (
        <div className="card overflow-hidden">
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

      {tab === "documents" && (
        <div className="card overflow-hidden">
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
      )}

      {tab === "signatures" && (
        <div className="card overflow-hidden">
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

      {tab === "audit" && (
        <div className="card overflow-hidden">
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

      {lifecycleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setLifecycleModal(null)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-neutral-900">{lifecycleModal === "suspend" ? "Suspend contract" : "Terminate contract"}</h3>
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
            <div className="space-y-1">
              <label className="text-xs font-semibold text-neutral-600">Reason <span className="text-red-500">*</span></label>
              <textarea className="form-input h-24 resize-none" value={lifecycleReason} onChange={(e) => setLifecycleReason(e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setLifecycleModal(null)}>Cancel</button>
              <button className="btn-primary flex-1 disabled:opacity-60" disabled={!lifecycleReason.trim()} onClick={runLifecycle}>
                {lifecycleModal === "suspend" ? "Suspend" : "Terminate"}
              </button>
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
