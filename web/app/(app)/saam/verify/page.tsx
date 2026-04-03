"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const DOC_TYPES = [
  { value: "travel",         label: "Travel Request",        icon: "flight_takeoff" },
  { value: "leave",          label: "Leave Request",         icon: "event_available" },
  { value: "imprest",        label: "Imprest Request",       icon: "account_balance_wallet" },
  { value: "procurement",    label: "Procurement Request",   icon: "shopping_cart" },
  { value: "correspondence", label: "Correspondence",        icon: "mail" },
];

export default function VerifyDocumentPage() {
  const router = useRouter();
  const [docType, setDocType] = useState("");
  const [docId, setDocId]     = useState("");

  function handleVerify() {
    if (!docType || !docId.trim()) return;
    router.push(`/saam/verify/${docType}/${docId.trim()}`);
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-neutral-400">
        <Link href="/saam" className="hover:text-primary transition-colors">Signatures</Link>
        <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        <span className="text-neutral-600 font-medium">Verify Document</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="page-title">Verify Document</h1>
        <p className="page-subtitle">Check the signing trail and integrity of any signed document</p>
      </div>

      {/* Lookup card */}
      <div className="card p-6 space-y-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <span className="material-symbols-outlined text-[22px] text-primary">verified</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-neutral-900">Document Lookup</p>
            <p className="text-xs text-neutral-400">Select the document type and enter its ID</p>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-600">Document Type <span className="text-red-500">*</span></label>
          <select
            className="form-input"
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
          >
            <option value="">Select document type…</option>
            {DOC_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-neutral-600">Document ID <span className="text-red-500">*</span></label>
          <input
            type="number"
            min="1"
            className="form-input"
            placeholder="e.g. 42"
            value={docId}
            onChange={(e) => setDocId(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleVerify(); }}
          />
          <p className="text-[11px] text-neutral-400">The numeric ID shown in the document URL or reference.</p>
        </div>

        <button
          onClick={handleVerify}
          disabled={!docType || !docId.trim()}
          className="btn-primary w-full disabled:opacity-60 inline-flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-[18px]">search</span>
          Verify Document
        </button>
      </div>

      {/* Info panel */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-neutral-400">info</span>
          <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">What verification checks</p>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {[
            { icon: "lock",        title: "Immutable Audit Trail",   body: "Every signature event is recorded with a timestamp and cannot be altered." },
            { icon: "fingerprint", title: "SHA-256 Integrity Hash",  body: "Each signing event captures a hash of the document state at that moment."  },
            { icon: "fact_check",  title: "Full Approval Chain",     body: "See every approver, their action, step, and whether they acted under delegation." },
          ].map((item) => (
            <div key={item.icon} className="flex items-start gap-3 rounded-xl bg-neutral-50 border border-neutral-100 p-3">
              <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 flex-shrink-0">{item.icon}</span>
              <div>
                <p className="text-xs font-semibold text-neutral-800">{item.title}</p>
                <p className="text-xs text-neutral-500 mt-0.5">{item.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Doc type quick links */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-3">Quick access by type</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DOC_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setDocType(t.value)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                docType === t.value
                  ? "border-primary/40 bg-primary/5 text-primary"
                  : "border-neutral-100 text-neutral-600 hover:border-neutral-200 hover:bg-neutral-50"
              }`}
            >
              <span className="material-symbols-outlined text-[15px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
