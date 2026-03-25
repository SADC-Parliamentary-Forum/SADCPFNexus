"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HrGradeBand, HrSalaryScale, HrSalaryScaleNotch, HrSettingsStatus } from "@/lib/api";

interface Props {
  open: boolean;
  scale: Partial<HrSalaryScale> | null;
  gradeBands: HrGradeBand[];
  canApprove: boolean;
  canPublish: boolean;
  onClose: () => void;
  onSave: (data: Partial<HrSalaryScale> & { notches: HrSalaryScaleNotch[] }) => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onPublish?: () => void;
  saving?: boolean;
}

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

function formatAmount(val: number): string {
  return new Intl.NumberFormat("en-NA", { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
}

export function SalaryScaleSlideOver({
  open,
  scale,
  gradeBands,
  canApprove,
  canPublish,
  onClose,
  onSave,
  onSubmit,
  onApprove,
  onPublish,
  saving,
}: Props) {
  const isEdit = !!scale?.id;
  const status = (scale?.status ?? "draft") as HrSettingsStatus;
  const isDraft = !isEdit || status === "draft";
  const isReview = status === "review";
  const isApproved = status === "approved";

  const defaultNotches: HrSalaryScaleNotch[] = Array.from({ length: 12 }, (_, i) => ({
    notch: i + 1,
    annual: 0,
    monthly: 0,
  }));

  const [gradeBandId, setGradeBandId] = useState<number | "">(scale?.grade_band_id ?? "");
  const [currency, setCurrency] = useState(scale?.currency ?? "NAD");
  const [effectiveFrom, setEffectiveFrom] = useState(scale?.effective_from ?? new Date().toISOString().split("T")[0]);
  const [effectiveTo, setEffectiveTo] = useState(scale?.effective_to ?? "");
  const [notes, setNotes] = useState(scale?.notes ?? "");
  const [notches, setNotches] = useState<HrSalaryScaleNotch[]>(
    scale?.notches?.length ? scale.notches : defaultNotches.slice(0, 5)
  );

  if (!open) return null;

  const updateNotch = (idx: number, field: "annual" | "monthly", val: string) => {
    setNotches((prev) => {
      const next = [...prev];
      const num = parseFloat(val) || 0;
      next[idx] = { ...next[idx], [field]: num };
      // Auto-compute the other field
      if (field === "annual") next[idx].monthly = Math.round(num / 12);
      if (field === "monthly") next[idx].annual = num * 12;
      return next;
    });
  };

  const addNotch = () => {
    if (notches.length >= 12) return;
    setNotches((prev) => [...prev, { notch: prev.length + 1, annual: 0, monthly: 0 }]);
  };

  const removeNotch = (idx: number) => {
    setNotches((prev) => prev.filter((_, i) => i !== idx).map((n, i) => ({ ...n, notch: i + 1 })));
  };

  const handleSave = () => {
    onSave({
      ...(isEdit ? { id: scale?.id } : {}),
      grade_band_id: gradeBandId === "" ? undefined : gradeBandId,
      currency,
      effective_from: effectiveFrom,
      effective_to: effectiveTo || undefined,
      notes: notes || undefined,
      notches,
    } as any);
  };

  const selectedBand = gradeBands.find((g) => g.id === gradeBandId);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-semibold text-neutral-900">
              {isEdit ? "Edit Salary Scale" : "New Salary Scale"}
            </h2>
            {isEdit && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("badge text-[11px]", STATUS_BADGE[status])}>{status}</span>
                <span className="text-xs text-neutral-400">v{scale?.version_number ?? 1}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 ml-4">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Grade + currency + dates */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Grade Band *</label>
              <select
                className="form-input text-sm"
                value={gradeBandId}
                onChange={(e) => setGradeBandId(e.target.value ? Number(e.target.value) : "")}
                disabled={isEdit}
              >
                <option value="">— Select grade band —</option>
                {gradeBands.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.code} — {g.label} ({g.status})
                  </option>
                ))}
              </select>
              {selectedBand && (
                <p className="text-xs text-neutral-500 mt-1">
                  Notch range: {selectedBand.min_notch}–{selectedBand.max_notch} · {selectedBand.employment_category}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Currency</label>
              <input className="form-input text-sm uppercase" value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Effective From *</label>
              <input type="date" className="form-input text-sm" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Effective To</label>
              <input type="date" className="form-input text-sm" value={effectiveTo} onChange={(e) => setEffectiveTo(e.target.value)} />
            </div>
          </div>

          {/* Notch table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium text-neutral-700">Notch Structure ({notches.length}/12)</label>
              {isDraft && notches.length < 12 && (
                <button onClick={addNotch} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">add</span>
                  Add notch
                </button>
              )}
            </div>

            <div className="rounded-xl border border-neutral-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-neutral-50 text-xs text-neutral-500">
                    <th className="px-3 py-2 text-left font-medium w-14">Notch</th>
                    <th className="px-3 py-2 text-right font-medium">Annual ({currency})</th>
                    <th className="px-3 py-2 text-right font-medium">Monthly ({currency})</th>
                    {isDraft && <th className="w-8" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {notches.map((n, idx) => (
                    <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50/50"}>
                      <td className="px-3 py-1.5 text-center">
                        <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full">{n.notch}</span>
                      </td>
                      <td className="px-3 py-1.5">
                        {isDraft ? (
                          <input
                            type="number"
                            className="w-full text-right text-sm border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            value={n.annual || ""}
                            onChange={(e) => updateNotch(idx, "annual", e.target.value)}
                            placeholder="0"
                          />
                        ) : (
                          <span className="block text-right font-medium">{formatAmount(n.annual)}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        {isDraft ? (
                          <input
                            type="number"
                            className="w-full text-right text-sm border border-neutral-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                            value={n.monthly || ""}
                            onChange={(e) => updateNotch(idx, "monthly", e.target.value)}
                            placeholder="0"
                          />
                        ) : (
                          <span className="block text-right">{formatAmount(n.monthly)}</span>
                        )}
                      </td>
                      {isDraft && (
                        <td className="px-2 py-1.5">
                          <button onClick={() => removeNotch(idx)} className="text-neutral-300 hover:text-red-500 transition-colors">
                            <span className="material-symbols-outlined text-[16px]">remove_circle</span>
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Notes / Reference</label>
            <textarea
              className="form-input text-sm resize-none"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reference ExCo resolution or circular…"
            />
          </div>

          {/* Governance */}
          {isEdit && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-2">Governance</label>
              <div className="rounded-xl bg-neutral-50 border border-neutral-200 divide-y divide-neutral-100">
                {[
                  { label: "Status",       value: <span className={cn("badge text-[11px]", STATUS_BADGE[status])}>{status}</span> },
                  { label: "Approved by",  value: (scale as any)?.approver?.name ?? (scale?.approved_by ? `User #${scale.approved_by}` : "—") },
                  { label: "Published by", value: (scale as any)?.publisher?.name ?? (scale?.published_by ? `User #${scale.published_by}` : "—") },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs text-neutral-500">{label}</span>
                    <span className="text-xs font-medium text-neutral-800">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 px-6 py-4 flex items-center gap-2">
          <button onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>
          <div className="flex-1" />

          {isEdit && status === "draft" && onSubmit && (
            <button onClick={onSubmit} disabled={saving} className="btn-secondary text-sm px-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">send</span>
              Submit for Review
            </button>
          )}
          {isEdit && isReview && canApprove && onApprove && (
            <button onClick={onApprove} disabled={saving} className="btn-secondary text-sm px-4 flex items-center gap-1.5 text-green-700 border-green-300 hover:bg-green-50">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Approve
            </button>
          )}
          {isEdit && isApproved && canPublish && onPublish && (
            <button onClick={onPublish} disabled={saving} className="btn-primary text-sm px-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px]">publish</span>
              Publish
            </button>
          )}

          {(!isEdit || isDraft) && (
            <button
              onClick={handleSave}
              disabled={saving || !gradeBandId || notches.length === 0}
              className="btn-primary text-sm px-4 flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving && <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>}
              {isEdit ? "Save Draft" : "Create Draft"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
