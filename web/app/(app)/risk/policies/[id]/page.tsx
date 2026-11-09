"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { policyApi, type Policy, type RiskAttachment, type RiskDocumentType } from "@/lib/api";
import RiskDocumentsPanel from "@/components/ui/RiskDocumentsPanel";
import { RiskPageFrame } from "@/components/risk/RiskPageFrame";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const LEVEL_CLS: Record<string, string> = {
  low:      "text-green-700 bg-green-100 border-green-300",
  medium:   "text-yellow-700 bg-yellow-100 border-yellow-300",
  high:     "text-orange-700 bg-orange-100 border-orange-300",
  critical: "text-red-700 bg-red-100 border-red-300",
};

export default function PolicyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: paramId } = use(params);
  const { t } = useI18n();
  const toast = useToast();

  const [policy, setPolicy]       = useState<Policy | null>(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "documents">("details");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const id = Number(paramId);
    if (!Number.isFinite(id)) { setError(t("risk.policy.invalidId")); setLoading(false); return; }
    policyApi.get(id)
      .then((r) => setPolicy(r.data.data))
      .catch(() => setError(t("risk.policy.loadFailed")))
      .finally(() => setLoading(false));
  }, [paramId, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 animate-pulse">
        <div className="h-6 w-48 bg-neutral-200 rounded" />
        <div className="h-32 bg-neutral-100 rounded-xl" />
      </div>
    );
  }

  if (error || !policy) {
    return (
      <div className="mx-auto max-w-6xl">
        <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">{error ?? t("risk.policy.notFound")}</div>
        <Link href="/risk/policies" className="btn-secondary mt-4 inline-flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span> {t("common.back")}
        </Link>
      </div>
    );
  }

  const attachments: RiskAttachment[] = policy.attachments ?? [];
  const renewalDate = policy.renewal_date ? new Date(policy.renewal_date) : null;
  const daysToRenewal = renewalDate ? Math.floor((renewalDate.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <RiskPageFrame>
      <ModulePageHeader
        title={policy.title}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "risk.hub", href: "/risk" },
              { label: t("risk.policies.pageTitle"), href: "/risk/policies" },
              { label: policy.title },
            ]}
          />
        }
        meta={
          <span className={`badge-${policy.status === "active" ? "success" : "muted"} capitalize`}>
            {policy.status === "active" ? t("risk.policies.status.active") : policy.status === "archived" ? t("risk.policies.status.archived") : policy.status}
          </span>
        }
      />

      {/* Header card */}
      <div className="card p-6">
        <div className="flex items-start gap-4 flex-wrap justify-between">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-500 text-[22px]">policy</span>
              <p className="text-lg font-semibold text-neutral-900 leading-tight">{policy.title}</p>
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
                  {t("risk.policy.renewal", { date: formatDateShort(policy.renewal_date) })}
                  {daysToRenewal !== null && daysToRenewal < 0 && ` ${t("risk.policy.overdue")}`}
                  {daysToRenewal !== null && daysToRenewal >= 0 && daysToRenewal < 90 && ` ${t("risk.policy.dueSoon")}`}
                </span>
              )}
            </div>
          </div>
          <span className={`badge-${policy.status === "active" ? "success" : "muted"} capitalize`}>
            {policy.status === "active" ? t("risk.policies.status.active") : policy.status === "archived" ? t("risk.policies.status.archived") : policy.status}
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
              ? (attachments.length > 0 ? t("risk.policy.documentsCount", { count: attachments.length }) : t("risk.policy.documents"))
              : t("risk.policy.details")}
          </button>
        ))}
      </div>

      {/* Details Tab */}
      {activeTab === "details" && (
        <div className="space-y-5">
          {/* Description */}
          {policy.description && (
            <div className="card p-5">
              <h2 className="text-sm font-semibold text-neutral-800 mb-3">{t("risk.create.description")}</h2>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{policy.description}</p>
            </div>
          )}

          {/* Linked Risks */}
          <div className="card p-5">
            <h2 className="text-sm font-semibold text-neutral-800 mb-4">{t("risk.policy.linkedRisks")}</h2>
            {!policy.risks || policy.risks.length === 0 ? (
              <p className="text-xs text-neutral-400 italic">{t("risk.policy.noLinkedRisks")}</p>
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
              {t("risk.policy.linkHint")}
            </p>
          </div>
        </div>
      )}

      {/* Documents Tab */}
      {activeTab === "documents" && (
        <div className="card p-6">
          <h2 className="text-sm font-semibold text-neutral-800 mb-5">{t("risk.policy.policyDocuments")}</h2>
          <RiskDocumentsPanel
            documents={attachments}
            loading={false}
            uploading={uploading}
            onUpload={async (file: File, type: RiskDocumentType) => {
              setUploading(true);
              try {
                const r = await policyApi.uploadAttachment(policy.id, file, type);
                setPolicy((prev) => prev ? { ...prev, attachments: [r.data.data, ...(prev.attachments ?? [])] } : prev);
                toast.success(t("risk.policy.docUploaded"));
              } catch (err) {
                toast.error(t("risk.policy.docNotUploaded"), apiErrorMessage(err, t("risk.policy.docUploadFailed")));
                throw err;
              } finally { setUploading(false); }
            }}
            onDelete={async (id: number) => {
              try {
                await policyApi.deleteAttachment(policy.id, id);
                setPolicy((prev) => prev ? { ...prev, attachments: (prev.attachments ?? []).filter((a) => a.id !== id) } : prev);
                toast.success(t("risk.policy.docDeleted"));
              } catch (err) {
                toast.error(t("risk.policy.docNotDeleted"), apiErrorMessage(err, t("risk.policy.docDeleteFailed")));
                throw err;
              }
            }}
            downloadUrl={(id: number) => policyApi.downloadAttachmentUrl(policy.id, id)}
          />
        </div>
      )}

      <Link href="/risk/policies" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
        <span className="material-symbols-outlined text-[16px]">arrow_back</span>
        {t("risk.policy.backToLibrary")}
      </Link>
    </RiskPageFrame>
  );
}
