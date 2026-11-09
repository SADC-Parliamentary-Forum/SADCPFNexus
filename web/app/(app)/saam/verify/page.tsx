"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const DOC_TYPES = [
  { value: "travel",         label: "saam.verify.docType.travel",        icon: "flight_takeoff" },
  { value: "leave",          label: "saam.verify.docType.leave",         icon: "event_available" },
  { value: "imprest",        label: "saam.verify.docType.imprest",       icon: "account_balance_wallet" },
  { value: "procurement",    label: "saam.verify.docType.procurement",   icon: "shopping_cart" },
  { value: "correspondence", label: "saam.module.correspondence",        icon: "mail" },
];

export default function VerifyDocumentPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [docType, setDocType] = useState("");
  const [docId, setDocId]     = useState("");

  function handleVerify() {
    if (!docType || !docId.trim()) return;
    router.push(`/saam/verify/${docType}/${docId.trim()}`);
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/saam" className="hover:text-primary transition-colors">{t("saam.breadcrumb")}</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-600 font-medium">{t("saam.verify.title")}</span>
      </nav>

      {/* Header */}
      <ModulePageHeader
        title={t("saam.verify.title")}
        subtitle={t("saam.verify.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("saam.verify.title") }]} />}
      />

      {/* Lookup card */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <span className="material-symbols-outlined text-[22px] text-primary">verified</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">{t("saam.verify.lookup")}</p>
            <p className="text-xs text-neutral-400">{t("saam.verify.lookupHint")}</p>
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="saam-verify-document-type" className="text-xs font-semibold text-neutral-600">{t("saam.verify.docTypeLabel")} <span className="text-red-500">*</span></label>
          <select id="saam-verify-document-type"
            className="form-input"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="">{t("saam.verify.selectType")}</option>
            {DOC_TYPES.map((dt) => (
              <option key={dt.value} value={dt.value}>{t(dt.label)}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="saam-verify-document-id" className="text-xs font-semibold text-neutral-600">{t("saam.verify.docIdLabel")} <span className="text-red-500">*</span></label>
          <input id="saam-verify-document-id"
            type="number"
            min="1"
            className="form-input"
            placeholder={t("saam.verify.docIdPlaceholder")}
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
          />
          <p className="text-[11px] text-neutral-400">{t("saam.verify.docIdHint")}</p>
        </div>

        <button
          onClick={handleVerify}
          disabled={!docType || !docId.trim()}
          className="btn-primary w-full disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          {t("saam.verify.title")}
        </button>
      </div>

      {/* Info panel */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{t("saam.verify.checksTitle")}</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: "lock",        title: "saam.verify.check.auditTitle",   body: "saam.verify.check.auditBody" },
            { icon: "fingerprint", title: "saam.verify.check.hashTitle",  body: "saam.verify.check.hashBody"  },
            { icon: "fact_check",  title: "saam.verify.check.chainTitle",     body: "saam.verify.check.chainBody" },
          ].map((item) => (
            <div key={item.icon} className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-3">
              <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-xs font-semibold text-neutral-800">{t(item.title)}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{t(item.body)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Doc type quick links */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">{t("saam.verify.quickAccess")}</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DOC_TYPES.map((dt) => (
            <button
              key={dt.value}
              onClick={() => setDocType(dt.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                docType === dt.value
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-neutral-100 text-neutral-600 hover:border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{dt.icon}</span>
              {t(dt.label)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
