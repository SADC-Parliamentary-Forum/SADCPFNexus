"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { HrGradeBand, HrJobFamily, HrSettingsStatus } from "@/lib/api";

type Tab = "basic" | "benefits" | "compensation" | "governance";

interface Props {
  open: boolean;
  grade: Partial<HrGradeBand> | null;
  jobFamilies: HrJobFamily[];
  canApprove: boolean;
  canPublish: boolean;
  onClose: () => void;
  onSave: (data: Partial<HrGradeBand>) => void;
  onSubmit?: () => void;
  onApprove?: () => void;
  onPublish?: () => void;
  saving?: boolean;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "basic",        label: "Basic Info",         icon: "info" },
  { key: "benefits",     label: "Leave & Benefits",   icon: "event_available" },
  { key: "compensation", label: "Travel & Pay",       icon: "payments" },
  { key: "governance",   label: "Governance",         icon: "policy" },
];

const STATUS_BADGE: Record<HrSettingsStatus, string> = {
  draft:     "badge-muted",
  review:    "badge-warning",
  approved:  "badge-primary",
  published: "badge-success",
  archived:  "badge-muted",
};

export function GradeBandSlideOver({
  open,
  grade,
  jobFamilies,
  canApprove,
  canPublish,
  onClose,
  onSave,
  onSubmit,
  onApprove,
  onPublish,
  saving,
}: Props) {
  const isEdit = !!grade?.id;
  const [tab, setTab] = useState<Tab>("basic");
  const [form, setForm] = useState<Partial<HrGradeBand>>(
    grade ?? {
      code: "", label: "", band_group: "C", employment_category: "local",
      min_notch: 1, max_notch: 12, probation_months: 6, notice_period_days: 30,
      leave_days_per_year: 21, overtime_eligible: false,
      medical_aid_eligible: true, housing_allowance_eligible: false,
      travel_class: "economy", effective_from: new Date().toISOString().split("T")[0],
    }
  );

  const set = <K extends keyof HrGradeBand>(key: K, val: HrGradeBand[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  if (!open) return null;

  const status = (form.status ?? "draft") as HrSettingsStatus;
  const isDraft = status === "draft";
  const isReview = status === "review";
  const isApproved = status === "approved";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100">
          <div>
            <h2 className="font-semibold text-neutral-900">
              {isEdit ? `Grade Band — ${grade?.code}` : "New Grade Band"}
            </h2>
            {isEdit && (
              <div className="flex items-center gap-2 mt-0.5">
                <span className={cn("badge text-[11px]", STATUS_BADGE[status])}>{status}</span>
                <span className="text-xs text-neutral-400">v{form.version_number ?? 1}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 ml-4">
            <span className="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-neutral-100 px-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-3 text-xs font-medium border-b-2 transition-colors",
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-neutral-500 hover:text-neutral-700"
              )}
            >
              <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* ── Tab 1: Basic Info ── */}
          {tab === "basic" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Grade Code *</label>
                  <input
                    className="form-input text-sm uppercase"
                    value={form.code ?? ""}
                    onChange={(e) => set("code", e.target.value.toUpperCase())}
                    placeholder="e.g. C2"
                    maxLength={10}
                    disabled={isEdit && !isDraft}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Band Group *</label>
                  <select
                    className="form-input text-sm"
                    value={form.band_group ?? "C"}
                    onChange={(e) => set("band_group", e.target.value as HrGradeBand["band_group"])}
                    disabled={isEdit && !isDraft}
                  >
                    <option value="A">A — Executive</option>
                    <option value="B">B — Senior/Manager</option>
                    <option value="C">C — Officer</option>
                    <option value="D">D — Support</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Grade Label *</label>
                <input
                  className="form-input text-sm"
                  value={form.label ?? ""}
                  onChange={(e) => set("label", e.target.value)}
                  placeholder="e.g. Senior Officer"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Employment Category *</label>
                <select
                  className="form-input text-sm"
                  value={form.employment_category ?? "local"}
                  onChange={(e) => set("employment_category", e.target.value as HrGradeBand["employment_category"])}
                >
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="researcher">Researcher</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Job Family</label>
                <select
                  className="form-input text-sm"
                  value={form.job_family_id ?? ""}
                  onChange={(e) => set("job_family_id", e.target.value ? Number(e.target.value) : null as any)}
                >
                  <option value="">— None —</option>
                  {jobFamilies.map((jf) => (
                    <option key={jf.id} value={jf.id}>{jf.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Effective From *</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={form.effective_from ?? ""}
                    onChange={(e) => set("effective_from", e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Effective To</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={form.effective_to ?? ""}
                    onChange={(e) => set("effective_to", e.target.value || null as any)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Notes / Policy Reference</label>
                <textarea
                  className="form-input text-sm resize-none"
                  rows={3}
                  value={form.notes ?? ""}
                  onChange={(e) => set("notes", e.target.value)}
                  placeholder="Reference ExCo resolution or policy document…"
                />
              </div>
            </>
          )}

          {/* ── Tab 2: Leave & Benefits ── */}
          {tab === "benefits" && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Min Notch</label>
                  <input
                    type="number"
                    className="form-input text-sm"
                    min={1} max={12}
                    value={form.min_notch ?? 1}
                    onChange={(e) => set("min_notch", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Max Notch</label>
                  <input
                    type="number"
                    className="form-input text-sm"
                    min={1} max={12}
                    value={form.max_notch ?? 12}
                    onChange={(e) => set("max_notch", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Leave Days / yr</label>
                  <input
                    type="number"
                    className="form-input text-sm"
                    min={0} step={0.5}
                    value={form.leave_days_per_year ?? 21}
                    onChange={(e) => set("leave_days_per_year", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Probation (months)</label>
                  <input
                    type="number"
                    className="form-input text-sm"
                    min={0} max={24}
                    value={form.probation_months ?? 6}
                    onChange={(e) => set("probation_months", Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">Notice Period (days)</label>
                  <input
                    type="number"
                    className="form-input text-sm"
                    min={0}
                    value={form.notice_period_days ?? 30}
                    onChange={(e) => set("notice_period_days", Number(e.target.value))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Acting Allowance Rate</label>
                <div className="relative">
                  <input
                    type="number"
                    className="form-input text-sm pr-10"
                    min={0} max={100} step={0.5}
                    value={form.acting_allowance_rate != null ? Number(form.acting_allowance_rate) * 100 : ""}
                    onChange={(e) =>
                      set("acting_allowance_rate", e.target.value ? Number(e.target.value) / 100 : null as any)
                    }
                    placeholder="0"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-neutral-400">%</span>
                </div>
                <p className="text-xs text-neutral-400 mt-1">Percentage of base salary. Leave blank if not eligible.</p>
              </div>

              <div className="space-y-2">
                {([
                  ["medical_aid_eligible",       "Medical Aid Eligible"],
                  ["housing_allowance_eligible",  "Housing Allowance Eligible"],
                ] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 cursor-pointer">
                    <span className="text-sm text-neutral-700">{label}</span>
                    <div
                      onClick={() => set(key, !form[key] as any)}
                      className={cn(
                        "w-9 h-5 rounded-full relative transition-colors cursor-pointer",
                        form[key] ? "bg-primary" : "bg-neutral-300"
                      )}
                    >
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", form[key] ? "translate-x-4" : "translate-x-0.5")} />
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {/* ── Tab 3: Travel & Compensation ── */}
          {tab === "compensation" && (
            <>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Travel Class</label>
                <select
                  className="form-input text-sm"
                  value={form.travel_class ?? "economy"}
                  onChange={(e) => set("travel_class", e.target.value as HrGradeBand["travel_class"])}
                >
                  <option value="">— Not specified —</option>
                  <option value="economy">Economy</option>
                  <option value="business">Business</option>
                  <option value="first">First Class</option>
                </select>
              </div>

              <label className="flex items-center justify-between py-2 px-3 rounded-lg bg-neutral-50 cursor-pointer">
                <div>
                  <p className="text-sm font-medium text-neutral-700">Overtime Eligible</p>
                  <p className="text-xs text-neutral-500">Staff at this grade may claim overtime pay.</p>
                </div>
                <div
                  onClick={() => set("overtime_eligible", !form.overtime_eligible as any)}
                  className={cn(
                    "w-9 h-5 rounded-full relative transition-colors cursor-pointer shrink-0",
                    form.overtime_eligible ? "bg-primary" : "bg-neutral-300"
                  )}
                >
                  <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform", form.overtime_eligible ? "translate-x-4" : "translate-x-0.5")} />
                </div>
              </label>
            </>
          )}

          {/* ── Tab 4: Governance ── */}
          {tab === "governance" && (
            <div className="space-y-4">
              {!isEdit ? (
                <p className="text-sm text-neutral-500 italic">
                  Governance details will appear after the grade band is created.
                </p>
              ) : (
                <>
                  <div className="rounded-xl bg-neutral-50 border border-neutral-200 divide-y divide-neutral-100">
                    {[
                      { label: "Status",   value: <span className={cn("badge", STATUS_BADGE[status])}>{status}</span> },
                      { label: "Version",  value: `v${form.version_number ?? 1}` },
                      { label: "Effective From", value: form.effective_from ?? "—" },
                      { label: "Approved by",    value: (form as any).approver?.name ?? (form.approved_by ? `User #${form.approved_by}` : "—") },
                      { label: "Approved at",    value: form.approved_at ? new Date(form.approved_at).toLocaleString() : "—" },
                      { label: "Published by",   value: (form as any).publisher?.name ?? (form.published_by ? `User #${form.published_by}` : "—") },
                      { label: "Published at",   value: form.published_at ? new Date(form.published_at).toLocaleString() : "—" },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs text-neutral-500">{label}</span>
                        <span className="text-xs font-medium text-neutral-800">{value}</span>
                      </div>
                    ))}
                  </div>

                  {status === "published" && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs text-amber-700">
                        <span className="font-medium">Published record.</span> This grade cannot be edited directly.
                        Use &ldquo;New Version&rdquo; to create a draft revision for review.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-100 px-6 py-4 flex items-center gap-2">
          <button onClick={onClose} className="btn-secondary text-sm px-4">Cancel</button>

          <div className="flex-1" />

          {/* Lifecycle actions for existing records */}
          {isEdit && isDraft && onSubmit && (
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

          {/* Save — only for draft/new */}
          {(!isEdit || isDraft) && (
            <button
              onClick={() => onSave(form)}
              disabled={saving || !form.code || !form.label}
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
