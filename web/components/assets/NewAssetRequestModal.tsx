"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { assetRequestsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";

export const MIN_ASSET_REQUEST_JUSTIFICATION = 20;

export function NewAssetRequestModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [justification, setJustification] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = justification.trim();
  const canSubmit = trimmed.length >= MIN_ASSET_REQUEST_JUSTIFICATION && !submitting;

  const reset = () => {
    setJustification("");
    setError(null);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await assetRequestsApi.create({ justification: trimmed });
      reset();
      onCreated();
    } catch (err) {
      setError(apiErrorMessage(err, "Failed to submit request. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Request an asset"
      description="Describe what you need and why. Managers will review the request."
      onClose={handleClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={handleClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="new-asset-request-form"
            disabled={!canSubmit}
            className="btn-primary flex items-center gap-2 py-2 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                Submitting…
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                Submit request
              </>
            )}
          </button>
        </>
      }
    >
      <form id="new-asset-request-form" onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700" role="alert">
            {error}
          </div>
        ) : null}
        <div className="space-y-1.5">
          <label htmlFor="asset-request-justification" className="block text-sm font-medium text-neutral-700">
            Justification <span className="text-red-500">*</span>
          </label>
          <textarea
            id="asset-request-justification"
            rows={5}
            required
            minLength={MIN_ASSET_REQUEST_JUSTIFICATION}
            maxLength={2000}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder="Describe the asset needed and why it is required…"
            className="form-input resize-none"
            disabled={submitting}
          />
          <p className="text-xs text-neutral-500">
            Minimum {MIN_ASSET_REQUEST_JUSTIFICATION} characters.
            {trimmed.length > 0 ? (
              <span className={trimmed.length >= MIN_ASSET_REQUEST_JUSTIFICATION ? " text-green-700" : " text-amber-700"}>
                {" "}
                {trimmed.length} / {MIN_ASSET_REQUEST_JUSTIFICATION}
              </span>
            ) : null}
          </p>
        </div>
      </form>
    </Modal>
  );
}
