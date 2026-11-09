"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { assetRequestsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  // The parent's onCreated shows the success toast; this modal reports failures.
  const toast = useToast();
  const { t } = useI18n();
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
      const message = apiErrorMessage(err, t("assets.requestModal.submitFailed"));
      setError(message);
      toast.error(t("assets.requestModal.notSubmitted"), message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t("assets.requestModal.title")}
      description={t("assets.requestModal.description")}
      onClose={handleClose}
      size="md"
      footer={
        <>
          <button type="button" className="btn-secondary py-2 px-4 text-sm" onClick={handleClose} disabled={submitting}>
            {t("common.cancel")}
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
                {t("imprest.create.submitting")}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">send</span>
                {t("assets.requestModal.submit")}
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
            {t("assets.requestModal.justification")} <span className="text-red-500">*</span>
          </label>
          <textarea
            id="asset-request-justification"
            rows={5}
            required
            minLength={MIN_ASSET_REQUEST_JUSTIFICATION}
            maxLength={2000}
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            placeholder={t("assets.requestModal.placeholder")}
            className="form-input resize-none"
            disabled={submitting}
          />
          <p className="text-xs text-neutral-500">
            {t("assets.requestModal.minimum", { min: MIN_ASSET_REQUEST_JUSTIFICATION })}
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
