"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { policyApi, type Policy, type RiskAttachment, type RiskDocumentType } from "@/lib/api";
import RiskDocumentsPanel from "@/components/ui/RiskDocumentsPanel";
import { formatDateShort } from "@/lib/utils";

const LEVEL_CLS: Record<string, string> = {
  low:      "text-green-700 bg-green-100 border-green-300",
  medium:   "text-yellow-700 bg-yellow-100 border-yellow-300",
  high:     "text-orange-700 bg-orange-100 border-orange-300",
  critical: "text-red-700 bg-red-100 border-red-300",
};

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = use(params);

  const [policy, setPolicy]       = useState<Policy | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "documents">("details");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) { setError("Invalid policy ID"); setLoading(false); return; }
    policyApi.get(id)
      .then((r) => setPolicy(r.data.data))
      .catch(() => setError("Failed to load policy."))
      .finally(() => setLoading(false));
  }, [paramId]);

  if (loading) {
    return (
      <div className="max-w-4xl space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded" />
        <div className="h-32 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="max-w-4xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{error ?? "Policy not found."}</div>
        <Link href="/risk/policies" className="btn-secondary mt-4 inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> Back
        </Link>
      </div>
    );
  }

  const attachments: RiskAttachment[] = policy.attachments ?? [];
  const renewalDate = policy.renewal_date ? new Date(policy.renewal_date) : null;
  const daysToRenewal = renewalDate ? Math.floor((renewalDate.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-sm text-neutral-500">
        <Link href="/risk" className="hover:text-primary">Risk Register</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <Link href="/risk/policies" className="hover:text-primary">Policy Library</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-700 truncate max-w-xs">{policy.title}</span>
      </div>

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start gap-4 flex-wrap justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500 text-[22px]">policy</span>
              <h1 className="text-xl font-bold text-neutral-900 leading-tight">{policy.title}</h1>
            </div>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-neutral-500">
              {policy.owner_name && (
                <span className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">person</span>
                  {policy.owner_name}
                </span>
              )}
              {policy.renewal_date && (
                <span className={`flex items-center gap-1 font-semibold ${
                  daysToRenewal !== null && daysToRenewal < 0 ? "text-red-600" :
                  daysToRenewal !== null && daysToRenewal < 90 ? "text-amber-700" : ""
                }`}>
                  <span className="material-symbols-outlined text-[14px]">event</span>
                  Renewal: {formatDateShort(policy.renewal_date)}
                  {daysToRenewal !== null && daysToRenewal < 0 && " (Overdue)"}
                  {daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal < 90 && " (Due soon)"}
                </span>
              )}
            </div>
          </div>
          <span className={`badge-${policy.status === "active" ? "success" : "muted"} capitalize`}>
            {policy.status}
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-neutral-200">
        {(["details", "documents"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-semibold capitalize border-b-2 transition-colors -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-neutral-500 hover:text-neutral-700"
            }`}
          >
            {tab === "documents"
              ? `Documents${attachments.length > 0 ? ` (${attachments.length})` : ""}`
              : "Details"}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="space-y-5">
          {/* Description */}
          {policy.description && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-800 mb-3">Description</h2>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{policy.description}</p>
            </div>
          )}

          {/* Linked Risks */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">Linked Risks</h2>
            {!policy.risks || policy.risks.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">No risks linked to this policy yet. Link from the risk detail page.</p>
            ) : (
              <div className="space-y-2">
                {policy.risks.map((r) => (
                  <Link
                    key={r.id}
                    href={`/risk/${r.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl border border-neutral-100 bg-neutral-50/50 hover:bg-white hover:border-neutral-200 transition-all"
                  >
                    <span className="material-symbols-outlined text-neutral-400 text-[18px]">shield</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-neutral-900 truncate">{r.title}</p>
                      <p className="text-xs text-neutral-400 font-mono">{r.risk_code}</p>
                    </div>
                    <span className="material-symbols-outlined text-neutral-300 text-[16px]">chevron_right</span>
                  </Link>
                ))}
              </div>
            )}
            <p className="text-xs text-neutral-400 mt-3 italic">
              To link this policy to a risk, open the risk and use the "Related Policies" tab.
            </p>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">Policy Documents</h2>
          <RiskDocumentsPanel
            documents={attachments}
            loading={false}
            uploading={uploading}
            onUpload={async (file: File, type: RiskDocumentType) => {
              setUploading(true);
              try {
                const r = await policyApi.uploadAttachment(policy.id, file, type);
                setPolicy((prev) => prev ? { ...prev, attachments: [r.data.data, ...(prev.attachments ?? [])] } : prev);
              } finally { setUploading(false); }
            }}
            onDelete={async (id: number) => {
              await policyApi.deleteAttachment(policy.id, id);
              setPolicy((prev) => prev ? { ...prev, attachments: (prev.attachments ?? []).filter((a) => a.id !== id) } : prev);
            }}
            downloadUrl={(id: number) => policyApi.downloadAttachmentUrl(policy.id, id)}
          />
        </div>
      )}

      <Link href="/risk/policies" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        Back to Policy Library
      </Link>
    </div>
  );
}
