"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assetRequestsApi } from "@/lib/api";

export default function NewAssetRequestPage() {
  const router = useRouter();
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = justification.trim().length >= 20;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await assetRequestsApi.create({ justification: justification.trim() });
      router.push("/assets/requests");
    } catch (err: any) {
      const msg =
        err?.response?.data?.message ??
        err?.message ??
        "Failed to submit request. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Page header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
          <Link href="/assets" className="hover:text-neutral-700 transition-colors">Assets</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <Link href="/assets/requests" className="hover:text-neutral-700 transition-colors">Requests</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">New Request</span>
        </div>
        <h1 className="page-title">Request an Asset</h1>
        <p className="page-subtitle">Fill in the details below to submit a new asset request.</p>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="card p-6 space-y-6">
        {/* Justification */}
        <div className="space-y-1.5">
          <label htmlFor="justification" className="block text-sm font-medium text-neutral-700">
            Justification / Description
            <span className="text-red-500 ml-0.5">*</span>
          </label>
          <textarea
            id="justification"
            rows={5}
            required
            minLength={20}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Describe the asset needed and why it is required..."
            className="form-input resize-none"
          />
          <p className="text-xs text-neutral-400">
            Minimum 20 characters.{" "}
            {justification.trim().length > 0 && (
              <span className={justification.trim().length >= 20 ? "text-green-600" : "text-amber-600"}>
                {justification.trim().length} / 20
              </span>
            )}
          </p>
        </div>

        {/* Supporting document */}
        <div className="space-y-1.5">
          <label htmlFor="document" className="block text-sm font-medium text-neutral-700">
            Supporting Document
          </label>
          <input
            id="document"
            type="file"
            accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
            className="form-input py-2 text-sm text-neutral-600 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
          />
          <p className="text-xs text-neutral-400">
            Optional: attach a purchase quote or approval memo.
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-100">
          <Link
            href="/assets/requests"
            className="btn-secondary py-2 px-4 text-sm"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={!canSubmit || submitting}
            className="btn-primary flex items-center gap-2 py-2 px-5 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Submitting…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                Submit Request
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
