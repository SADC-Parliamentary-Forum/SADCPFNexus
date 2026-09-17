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

type Tab = "overview" | "deliverables" | "documents" | "approvals";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const contractId = Number(id);
  const qc = useQueryClient();
  const toast = useToast();
  const user = getStoredUser();

  const [tab, setTab] = useState<Tab>("overview");
  const [commentModal, setCommentModal] = useState<null | "return" | "reject">(null);
  const [comment, setComment] = useState("");

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
  const inReview = ["IN_REVIEW", "APPROVAL_PENDING"].includes(lifecycle);
  const isDraft = ["DRAFT", "CHANGES_REQUESTED"].includes(lifecycle);

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
        {(["overview", "deliverables", "documents", "approvals"] as Tab[]).map((t) => (
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
              <thead><tr><th>#</th><th>Deliverable</th><th>Responsible</th><th>Due</th><th>Status</th></tr></thead>
              <tbody>
                {(contract.deliverables ?? []).map((d) => (
                  <tr key={d.id}>
                    <td className="text-sm">{d.number}</td>
                    <td className="text-sm font-medium text-neutral-800">{d.name}</td>
                    <td className="text-sm text-neutral-600 capitalize">{d.responsible_party}</td>
                    <td className="text-sm text-neutral-500">{d.due_date ? formatDateShort(d.due_date) : "—"}</td>
                    <td className="text-sm capitalize">{d.status.replace(/_/g, " ")}</td>
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

      {tab === "approvals" && (
        <div className="card p-5">
          {contract.approval_request ? (
            <ApprovalTimeline request={contract.approval_request} />
          ) : (
            <p className="text-sm text-neutral-500">This contract has not been submitted for approval yet.</p>
          )}
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
