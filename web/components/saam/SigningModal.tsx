"use client";

import { useState, useEffect } from "react";
import { saamApi, type SignatureProfile, type SignatureEvent } from "@/lib/api";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Correspondence and other SAAM-first flows. Omit when onWorkflowApprove is set. */
  onSigned?: (event: SignatureEvent) => void;
  /**
   * Workflow inbox / module approve+sign. Calls the workflow approve endpoint
   * with confirm_password so the backend pins the specimen — do not also call saamApi.signDocument.
   */
  onWorkflowApprove?: (payload: { password: string; comment?: string }) => Promise<void>;
  signableType: string;   // e.g. 'correspondence'
  signableId: number;
  action: "approve" | "reject" | "review" | "return" | "acknowledge";
  stepKey?: string;
  requirePassword?: boolean;
  title?: string;
}

const actionLabel: Record<Props["action"], string> = {
  approve:     "Sign & Approve",
  reject:      "Sign & Reject",
  review:      "Sign & Forward",
  return:      "Sign & Return",
  acknowledge: "Sign & Acknowledge",
};

const actionColor: Record<Props["action"], string> = {
  approve:     "btn-primary",
  reject:      "bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-60",
  review:      "btn-primary",
  return:      "btn-secondary",
  acknowledge: "btn-primary",
};

export function SigningModal({
  isOpen, onClose, onSigned, onWorkflowApprove, signableType, signableId,
  action, stepKey, requirePassword = true, title,
}: Props) {
  const [profile, setProfile] = useState<SignatureProfile | null>(null);
  const [comment, setComment] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setComment("");
    setPassword("");
    setImgError(false);
    setProfileLoading(true);
    saamApi.getProfile()
      .then((res) => {
        const full = (res.data.data ?? []).find((p) => p.type === "full" && p.status === "active");
        setProfile(full ?? null);
      })
      .catch(() => setProfile(null))
      .finally(() => setProfileLoading(false));
  }, [isOpen]);

  async function handleSign() {
    if (requirePassword && !password.trim()) {
      setError("Please enter your password to sign.");
      return;
    }
    if (onWorkflowApprove && !profile?.active_version) {
      setError("Enrol your signature specimen in SAAM before approving this step.");
      return;
    }
    if ((action === "reject" || action === "return") && !comment.trim()) {
      setError("Please add a comment.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (onWorkflowApprove) {
        await onWorkflowApprove({
          password,
          comment: comment || undefined,
        });
        return;
      }
      const res = await saamApi.signDocument(signableType, signableId, {
        action,
        step_key: stepKey,
        comment: comment || undefined,
        signature_type: "full",
        confirm_password: password,
      });
      onSigned?.(res.data.data);
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
        ?.response?.data;
      const fieldError = data?.errors
        ? Object.values(data.errors).flat()[0]
        : undefined;
      setError(fieldError || data?.message || "Failed to sign. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[18px]">draw</span>
            </div>
            <h2 className="text-base font-semibold text-neutral-900">
              {title ?? actionLabel[action]}
            </h2>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-600">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Signature preview */}
        <div>
          <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">Your Signature</p>
          {profileLoading ? (
            <div className="h-16 bg-neutral-100 rounded-xl animate-pulse" />
          ) : profile?.active_version ? (
            <div className="bg-neutral-50 border border-neutral-100 rounded-xl p-3 flex items-center gap-3">
              {!imgError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/v1/saam/signature-image/${profile.active_version.id}`}
                  alt="signature"
                  className="max-h-12 max-w-[140px] object-contain"
                  onError={() => setImgError(true)}
                />
              ) : (
                <div className="h-12 flex items-center px-2">
                  <span className="text-xs text-neutral-400 italic">Preview unavailable</span>
                </div>
              )}
              <div className="flex-1 text-right">
                <p className="text-[10px] text-neutral-400">Version {profile.active_version.version_no}</p>
              </div>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 text-sm text-amber-700 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>warning</span>
              <span>
                No signature set up.{" "}
                <a href="/profile/signature" target="_blank" className="font-semibold underline">
                  Set up now
                </a>
                {onWorkflowApprove
                  ? ". This step cannot be approved until your specimen is enrolled."
                  : ". You can still sign without a graphical signature."}
              </span>
            </div>
          )}
        </div>

        {/* Comment */}
        <div>
          <label htmlFor="saam-SigningModal-comment" className="block text-xs font-semibold text-neutral-700 mb-1">
            Comment {action === "reject" || action === "return" ? "*" : "(optional)"}
          </label>
          <textarea id="saam-SigningModal-comment"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            className="form-input w-full resize-none"
            placeholder={
              action === "reject" || action === "return"
                ? "Explain what needs to change…"
                : "Optional notes…"
            }
          />
        </div>

        {/* Password re-entry */}
        {requirePassword && (
          <div>
            <label htmlFor="saam-SigningModal-your-password" className="block text-xs font-semibold text-neutral-700 mb-1">
              Your Password <span className="text-red-500">*</span>
            </label>
            <input id="saam-SigningModal-your-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="form-input w-full"
              placeholder="Re-enter your password to authenticate…"
              onKeyDown={(e) => { if (e.key === "Enter") handleSign(); }}
            />
            <p className="text-[10px] text-neutral-400 mt-1">
              Required to authenticate your digital signature.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="btn-secondary text-sm" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={handleSign}
            disabled={loading || (Boolean(onWorkflowApprove) && !profile?.active_version)}
            className={`${actionColor[action]} text-sm disabled:opacity-60 flex items-center gap-1.5`}
          >
            {loading ? (
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[16px]">gesture</span>
            )}
            {loading ? "Signing…" : actionLabel[action]}
          </button>
        </div>
      </div>
    </div>
  );
}
