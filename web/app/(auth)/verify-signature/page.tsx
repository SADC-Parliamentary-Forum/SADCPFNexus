"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatDateShort } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

interface VerificationResult {
  valid: boolean;
  document_type?: string | null;
  document_id?: number | string | null;
  document_version_id?: number | string | null;
  document_hash?: string | null;
  signature_meaning?: string | null;
  signature_method?: string | null;
  signed_at?: string | null;
  verification_reference?: string | null;
  note?: string | null;
}

function formatLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function PublicVerifySignaturePage() {
  const [token, setToken] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch(`${API_BASE}/api/v1/people-authority/public/verify-signature/${encodeURIComponent(token.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json?.message || json?.errors?.token?.[0] || "Verification failed");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Unable to reach verification service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-start justify-center p-6">
      <div className="w-full max-w-xl space-y-6 bg-white border border-neutral-200 rounded-xl p-6 shadow-sm">
        <div>
          <p className="text-xs uppercase tracking-wide text-neutral-500">SADC PF Nexus</p>
          <h1 className="text-2xl font-semibold text-neutral-900">Document signature verification</h1>
          <p className="text-sm text-neutral-600 mt-1">
            Enter a published verification token. Only approved metadata is shown.
          </p>
        </div>
        <form className="space-y-3" onSubmit={verify}>
          <input
            className="form-input w-full"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Verification token"
            required
          />
          <button type="submit" className="btn-primary text-sm px-4 py-2" disabled={loading || !token.trim()}>
            {loading ? "Verifying…" : "Verify"}
          </button>
        </form>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result ? (
          <div className="rounded-xl border border-neutral-200 overflow-hidden">
            <div
              className={`flex items-center gap-2 px-4 py-3 text-sm font-semibold ${
                result.valid ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {result.valid ? "verified" : "cancel"}
              </span>
              {result.valid ? "Signature Valid" : "Signature Invalid"}
            </div>
            <dl className="divide-y divide-neutral-100">
              {[
                ["Document", formatLabel(result.document_type)],
                ["Document Reference", result.document_id ? String(result.document_id) : "—"],
                ["Signed By (Meaning)", formatLabel(result.signature_meaning)],
                ["Signature Method", formatLabel(result.signature_method)],
                ["Date Signed", result.signed_at ? formatDateShort(result.signed_at) : "—"],
                ["Verification Reference", result.verification_reference || "—"],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-neutral-500">{label}</dt>
                  <dd className="font-medium text-neutral-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
            {result.note && (
              <p className="px-4 py-3 text-xs text-neutral-500 bg-neutral-50 border-t border-neutral-100">
                {result.note}
              </p>
            )}
          </div>
        ) : null}
        <Link href="/login" className="text-sm underline">Sign in</Link>
      </div>
    </div>
  );
}
