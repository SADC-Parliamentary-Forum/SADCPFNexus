"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { assetRequestsApi } from "@/lib/api";

export default function AssetRequestPage() {
  const router = useRouter();
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = justification.trim();
    if (!trimmed) {
      setError("Justification is required.");
      return;
    }
    if (trimmed.length > 2000) {
      setError("Justification must be at most 2000 characters.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await assetRequestsApi.create({ justification: trimmed });
      router.push("/assets");
      router.refresh();
    } catch (err: unknown) {
      const msg = err && typeof err === "object" && "response" in err
        ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
        : null;
      setError(msg ?? "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <Link href="/assets" className="text-sm font-medium text-neutral-500 hover:text-primary flex items-center gap-1 mb-2">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Assets
        </Link>
        <h1 className="page-title">Request Asset</h1>
        <p className="page-subtitle">
          Submit a request with a justification. Managers will review and approve; you will see the status under My Requests.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {error}
          </div>
        )}

        <div>
          <label htmlFor="justification" className="block text-sm font-medium text-neutral-700 mb-1">
            Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            id="justification"
            rows={5}
            maxLength={2000}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Explain why you need this asset (e.g. role, project, replacement of faulty equipment)."
            className="input w-full"
            disabled={submitting}
          />
          <p className="text-xs text-neutral-400 mt-1">{justification.length} / 2000</p>
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary">
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
          <Link href="/assets" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
