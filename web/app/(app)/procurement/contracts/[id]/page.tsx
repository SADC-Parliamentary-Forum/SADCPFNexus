"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { contractsApi, contractAttachmentsApi, CONTRACT_DOC_TYPES, type Contract, type ProcurementAttachment } from "@/lib/api";
import GenericDocumentsPanel from "@/components/ui/GenericDocumentsPanel";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "text-neutral-700 bg-neutral-100 border-neutral-200", icon: "edit_note"    },
  active:     { label: "Active",     cls: "text-green-700 bg-green-50 border-green-200",         icon: "check_circle" },
  completed:  { label: "Completed",  cls: "text-blue-700 bg-blue-50 border-blue-200",             icon: "task_alt"     },
  terminated: { label: "Terminated", cls: "text-red-700 bg-red-50 border-red-200",               icon: "cancel"       },
};

function getStoredUser() {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}
function canManageContracts() {
  const u = getStoredUser();
  return (u?.roles ?? []).some((r: string) =>
    ["Procurement Officer", "Finance Controller", "System Admin", "Secretary General"].includes(r)
  );
}

export default function ContractDetailPage({ params }: { params: { id: string } }) {
  const contractId  = Number(params.id);
  const queryClient = useQueryClient();

  const [showTerminateModal, setShowTerminateModal] = useState(false);
  const [terminateReason, setTerminateReason]       = useState("");
  const [terminateError, setTerminateError]         = useState<string | null>(null);
  const [activeTab, setActiveTab]                   = useState<"details" | "documents">("details");
  const [attachments, setAttachments]               = useState<ProcurementAttachment[]>([]);
  const [uploading, setUploading]                   = useState(false);

  useEffect(() => {
    if (contractId) contractAttachmentsApi.list(contractId).then((r) => setAttachments(r.data.data ?? [])).catch(() => {});
  }, [contractId]);

  const { data: contract, isLoading, isError } = useQuery({
    queryKey: ["contract", contractId],
    queryFn:  () => contractsApi.get(contractId).then((r) => r.data.data),
    enabled:  !!contractId,
  });

  const activateMutation = useMutation({
    mutationFn: () => contractsApi.activate(contractId),
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ["contract", contractId] }),
  });

  const terminateMutation = useMutation({
    mutationFn: () => contractsApi.terminate(contractId, terminateReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setShowTerminateModal(false);
    },
    onError: (e: unknown) => {
      setTerminateError((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed.");
    },
  });

  if (isLoading) return (
    <div className="max-w-3xl mx-auto space-y-5 animate-pulse">
      <div className="h-4 w-48 bg-neutral-100 rounded" />
      <div className="card p-6 space-y-3">
        <div className="h-6 w-64 bg-neutral-100 rounded" />
        <div className="h-4 w-40 bg-neutral-100 rounded" />
      </div>
    </div>
  );

  if (isError || !contract) return (
    <div className="max-w-3xl mx-auto card p-8 text-center space-y-3">
      <span className="material-symbols-outlined text-4xl text-neutral-300">error</span>
      <p className="text-sm text-neutral-500">Contract not found.</p>
      <Link href="/procurement/contracts" className="btn-secondary inline-flex items-center gap-1.5 text-sm py-2 px-4">Back</Link>
    </div>
  );

  const s       = statusConfig[contract.status] ?? statusConfig.draft;
  const canAct  = canManageContracts();

  // Days until expiry
  const daysLeft = contract.end_date
    ? Math.ceil((new Date(contract.end_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Tab Bar */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button key={tab} onClick={() => setActiveTab(tab)} className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${activeTab === tab ? "border-primary text-primary" : "border-transparent text-neutral-500 hover:text-neutral-700"}`}>
            {tab === "documents" ? `Documents${attachments.length > 0 ? ` (${attachments.length})` : ""}` : "Details"}
          </button>
        ))}
      </div>

      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">Contract Documents</h2>
          <GenericDocumentsPanel
            documents={attachments}
            documentTypes={CONTRACT_DOC_TYPES as unknown as { value: string; label: string; icon: string }[]}
            defaultType="signed_contract"
            loading={false}
            uploading={uploading}
            onUpload={async (file, type) => {
              setUploading(true);
              try { const r = await contractAttachmentsApi.upload(contractId, file, type); setAttachments((p) => [r.data.data, ...p]); }
              finally { setUploading(false); }
            }}
            onDelete={async (id) => { await contractAttachmentsApi.delete(contractId, id); setAttachments((p) => p.filter((a) => a.id !== id)); }}
            downloadUrl={(id) => contractAttachmentsApi.downloadUrl(contractId, id)}
          />
        </div>
      )}

      {activeTab === "details" && <>
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/procurement" className="hover:text-primary transition-colors">Procurement</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/procurement/contracts" className="hover:text-primary transition-colors">Contracts</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="font-mono text-neutral-600">{contract.reference_number}</span>
      </nav>

      {/* Hero */}
      <div className="card p-5">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-neutral-900">{contract.title}</h1>
            <p className="font-mono text-xs text-neutral-400 mt-0.5">{contract.reference_number}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.cls}`}>
              <span className="material-symbols-outlined text-[14px]">{s.icon}</span>
              {s.label}
            </span>
            {contract.status === "draft" && canAct && (
              <button
                onClick={() => activateMutation.mutate()}
                disabled={activateMutation.isPending}
                className="btn-primary inline-flex items-center gap-1.5 text-xs px-3 py-1.5"
              >
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                {activateMutation.isPending ? "Activating…" : "Activate"}
              </button>
            )}
            {contract.status === "active" && canAct && (
              <button
                onClick={() => setShowTerminateModal(true)}
                className="inline-flex items-center gap-1 text-xs text-red-600 border border-red-200 rounded-full px-3 py-1 bg-red-50 hover:bg-red-100 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">cancel</span>
                Terminate
              </button>
            )}
          </div>
        </div>

        {/* Expiry warning */}
        {contract.is_expired && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            <span className="material-symbols-outlined text-[16px]">event_busy</span>
            Contract expired on {formatDateShort(contract.end_date)}
          </div>
        )}
        {!contract.is_expired && contract.is_expiring_soon && daysLeft !== null && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-700">
            <span className="material-symbols-outlined text-[16px]">schedule</span>
            Contract expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""} on {formatDateShort(contract.end_date)}
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          {[
            { label: "Vendor",      icon: "storefront",     value: contract.vendor?.name ?? "—"                      },
            { label: "Value",       icon: "payments",       value: `${contract.currency} ${Number(contract.value).toLocaleString()}` },
            { label: "Start Date",  icon: "calendar_today", value: contract.start_date ? formatDateShort(contract.start_date) : "—"  },
            { label: "End Date",    icon: "event",          value: contract.end_date   ? formatDateShort(contract.end_date)   : "—"  },
          ].map((row) => (
            <div key={row.label}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="material-symbols-outlined text-[13px] text-neutral-300">{row.icon}</span>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{row.label}</p>
              </div>
              <p className="font-medium text-neutral-900">{row.value}</p>
            </div>
          ))}
        </div>

        {contract.description && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-neutral-300">notes</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Description</p>
            </div>
            <p className="text-sm text-neutral-700">{contract.description}</p>
          </div>
        )}

        {contract.termination_reason && (
          <div className="mt-4 pt-4 border-t border-neutral-50">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="material-symbols-outlined text-[13px] text-red-400">cancel</span>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Termination Reason</p>
            </div>
            <p className="text-sm text-red-700">{contract.termination_reason}</p>
          </div>
        )}
      </div>

      {/* Linked procurement request */}
      {contract.procurement_request && (
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="material-symbols-outlined text-[16px] text-neutral-400">assignment</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Linked Procurement Request</h3>
          </div>
          <Link href={`/procurement/${contract.procurement_request_id}`} className="font-mono text-xs text-primary hover:underline">
            {contract.procurement_request.reference_number}
          </Link>
          <p className="text-sm text-neutral-600 mt-0.5">{contract.procurement_request.title}</p>
        </div>
      )}

      <Link href="/procurement/contracts" className="inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-primary transition-colors">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Contracts
      </Link>
      </> /* end details tab */}

      {/* Terminate Modal */}
      {showTerminateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4" onClick={() => setShowTerminateModal(false)}>
          <div className="card w-full max-w-md p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-base font-bold text-neutral-900">Terminate Contract</h2>
            {terminateError && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{terminateError}</div>}
            <textarea
              className="form-input w-full h-24 resize-none"
              placeholder="Reason for termination…"
              value={terminateReason}
              onChange={(e) => setTerminateReason(e.target.value)}
            />
            <div className="flex gap-3">
              <button className="btn-secondary flex-1" onClick={() => setShowTerminateModal(false)}>Back</button>
              <button
                disabled={terminateMutation.isPending || !terminateReason.trim()}
                onClick={() => terminateMutation.mutate()}
                className="flex-1 rounded-lg bg-red-600 text-white text-sm font-medium py-2 hover:bg-red-700 disabled:opacity-60 transition-colors"
              >
                {terminateMutation.isPending ? "Terminating…" : "Confirm Terminate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
