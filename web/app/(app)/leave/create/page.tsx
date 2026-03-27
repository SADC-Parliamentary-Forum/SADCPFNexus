"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { leaveApi, lookupsApi, type LilAccrual } from "@/lib/api";

const STEPS = ["Leave Type", "Details", "LIL Linking", "Review & Submit"];

const LEAVE_TYPE_COLORS: Record<string, string> = {
  annual: "text-blue-600 bg-blue-50 border-blue-200",
  sick: "text-red-600 bg-red-50 border-red-200",
  lil: "text-purple-600 bg-purple-50 border-purple-200",
  special: "text-orange-600 bg-orange-50 border-orange-200",
  maternity: "text-pink-600 bg-pink-50 border-pink-200",
  paternity: "text-blue-600 bg-blue-50 border-blue-200",
};

interface FormData {
  leave_type: string;
  start_date: string;
  end_date: string;
  reason: string;
  selected_lil_ids: string[];
}

export default function LeaveCreatePage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<{ value: string; label: string; icon?: string }[]>([]);
  const [lilAccruals, setLilAccruals] = useState<LilAccrual[]>([]);
  const [form, setForm] = useState<FormData>({
    leave_type: "",
    start_date: "",
    end_date: "",
    reason: "",
    selected_lil_ids: [],
  });

  useEffect(() => {
    lookupsApi.get(["leave_types"]).then((res) => {
      setLeaveTypes(res.data.leave_types ?? []);
    }).catch(() => {});
    leaveApi.listLilAccruals().then((res) => {
      setLilAccruals((res.data as any).data ?? []);
    }).catch(() => {});
  }, []);

  const isLil = form.leave_type === "lil";

  const calcDays = () => {
    if (!form.start_date || !form.end_date) return 0;
    const start = new Date(form.start_date);
    const end = new Date(form.end_date);
    const diff = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(0, diff);
  };

  const daysRequested = calcDays();
  const hoursRequired = daysRequested * 8;

  const selectedAccruals = lilAccruals.filter((a) => form.selected_lil_ids.includes(a.id));
  const totalLinkedHours = selectedAccruals.reduce((sum, a) => sum + a.hours, 0);
  const remainingHours = hoursRequired - totalLinkedHours;

  const toggleLil = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selected_lil_ids: prev.selected_lil_ids.includes(id)
        ? prev.selected_lil_ids.filter((x) => x !== id)
        : [...prev.selected_lil_ids, id],
    }));
  };

  const effectiveSteps = isLil ? STEPS : STEPS.filter((_, i) => i !== 2);

  const canNext = () => {
    if (step === 0) return !!form.leave_type;
    if (step === 1) return form.start_date && form.end_date;
    if (step === 2 && isLil) return totalLinkedHours >= hoursRequired;
    return true;
  };

  const handleSubmit = async (asDraft: boolean) => {
    setSubmitting(true);
    try {
      const lil_linkings = selectedAccruals.length > 0
        ? selectedAccruals.map((a) => ({
            accrual_code: a.code,
            accrual_description: a.description,
            hours: a.hours,
            accrual_date: a.date,
            approved_by_name: a.approved_by ?? undefined,
          }))
        : undefined;
      const payload = {
        leave_type: form.leave_type as "annual" | "sick" | "lil" | "special" | "maternity" | "paternity",
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason || undefined,
        ...(lil_linkings && lil_linkings.length > 0 && { lil_linkings }),
      };
      const { data } = await leaveApi.create(payload);
      const createdId = data.data?.id ?? (data as { id?: number }).id;
      if (!asDraft && createdId) {
        await leaveApi.submit(createdId);
      }
      router.push("/leave");
    } catch {
      setSubmitting(false);
    } finally {
      setSubmitting(false);
    }
  };

  const displaySteps = isLil || step < 2 ? STEPS : STEPS.filter((_, i) => i !== 2);
  const actualStep = isLil ? step : step >= 2 ? step + 1 : step;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
          <a href="/leave" className="hover:text-primary transition-colors">Leave</a>
          <span>/</span>
          <span className="text-neutral-700 font-medium">New Request</span>
        </div>
        <h2 className="text-xl font-bold text-neutral-900">New Leave Request</h2>
        <p className="text-sm text-neutral-500 mt-0.5">Apply for leave and manage LIL hour linkings.</p>
      </div>

      {/* Stepper */}
      <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-4">
        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          {(isLil ? STEPS : STEPS.filter((_, i) => i !== 2)).map((label, i) => (
            <div key={i} className="flex items-center gap-1 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                  i < step ? "bg-primary text-white" :
                  i === step ? "bg-primary text-white" :
                  "bg-neutral-100 text-neutral-400"
                }`}>
                  {i < step ? <span className="material-symbols-outlined text-[12px]">check</span> : i + 1}
                </div>
                <span className={`text-[11px] font-medium whitespace-nowrap ${i === step ? "text-primary" : i < step ? "text-neutral-700" : "text-neutral-400"}`}>
                  {label}
                </span>
              </div>
              {i < (isLil ? STEPS : STEPS.filter((_, i) => i !== 2)).length - 1 && (
                <div className={`w-8 h-px mx-1 flex-shrink-0 ${i < step ? "bg-primary" : "bg-neutral-200"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Leave Type */}
      {step === 0 && (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900">Select Leave Type</h3>
          <div className="space-y-2">
            {leaveTypes.map((lt) => (
              <button
                key={lt.value}
                onClick={() => setForm((prev) => ({ ...prev, leave_type: lt.value }))}
                className={`w-full flex items-start gap-3 rounded-xl border p-4 text-left transition-all ${
                  form.leave_type === lt.value
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-neutral-200 hover:border-neutral-300 bg-white"
                }`}
              >
                <div className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${(LEAVE_TYPE_COLORS[lt.value] ?? "").split(" ").slice(1).join(" ") || "bg-neutral-50"}`}>
                  <span className={`material-symbols-outlined text-[20px] ${(LEAVE_TYPE_COLORS[lt.value] ?? "").split(" ")[0] || "text-neutral-600"}`}>{lt.icon ?? "event"}</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-neutral-900">{lt.label}</p>
                </div>
                {form.leave_type === lt.value && (
                  <span className="ml-auto material-symbols-outlined text-primary text-[20px]">check_circle</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 1: Details */}
      {step === 1 && (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900 flex items-center gap-2">
            Leave Details
            {form.leave_type && (
              <span className="text-xs text-neutral-400 font-normal">
                ({form.leave_type.charAt(0).toUpperCase() + form.leave_type.slice(1)} Leave)
              </span>
            )}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.start_date}
                onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-neutral-700">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                value={form.end_date}
                onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))}
              />
            </div>
          </div>

          {daysRequested > 0 && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-center justify-between">
              <span className="text-xs text-neutral-600">Duration</span>
              <span className="text-sm font-bold text-primary">{daysRequested} day{daysRequested !== 1 ? "s" : ""}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="block text-xs font-medium text-neutral-700">Reason <span className="text-neutral-400">(optional)</span></label>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
              placeholder="Provide a reason for your leave request..."
              value={form.reason}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
            />
          </div>

          {isLil && (
            <div className="rounded-lg bg-purple-50 border border-purple-100 p-3 flex items-start gap-2">
              <span className="material-symbols-outlined text-purple-500 text-[16px] mt-0.5">info</span>
              <p className="text-xs text-purple-700">
                Leave in Lieu requires {hoursRequired} hours of accruals to be linked. You will do this in the next step.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Step 2: LIL Linking (only for LIL type) */}
      {step === 2 && isLil && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Available LIL Hours</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-primary">
                  {lilAccruals.reduce((s, a) => s + a.hours, 0).toFixed(1)}
                </span>
                <span className="text-xs text-neutral-400">hrs</span>
              </div>
            </div>
            <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-4">
              <p className="text-xs text-neutral-500 mb-1">Required</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-neutral-900">{hoursRequired.toFixed(1)}</span>
                <span className="text-xs text-neutral-400">hrs</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-5">
            <h3 className="text-sm font-semibold text-neutral-900 mb-4">Select Accrual Source</h3>
            <div className="space-y-3">
              {lilAccruals.map((accrual) => {
                const isSelected = form.selected_lil_ids.includes(accrual.id);
                return (
                  <label
                    key={accrual.id}
                    className={`relative flex cursor-pointer rounded-xl border p-4 transition-all ${
                      isSelected ? "border-primary bg-primary/5" : "border-neutral-200 bg-white hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                        checked={isSelected}
                        onChange={() => toggleLil(accrual.id)}
                      />
                    </div>
                    <div className="ml-3 flex flex-1 flex-col">
                      <div className="flex justify-between">
                        <span className="text-sm font-semibold text-neutral-900">{accrual.description}</span>
                        <span className="text-sm font-mono font-bold text-primary">{accrual.hours.toFixed(1)} hrs</span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Accrued on {accrual.date}{accrual.approved_by ? ` · Approved by ${accrual.approved_by}` : " · Auto-Approved"}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {accrual.is_verified && (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700 ring-1 ring-green-600/20">Verified</span>
                        )}
                        <span className="inline-flex items-center rounded-full bg-neutral-50 px-2 py-0.5 text-[10px] font-medium text-neutral-600 ring-1 ring-neutral-400/20">Code: {accrual.code}</span>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Balance calculation */}
          <div className="rounded-xl bg-primary/5 border border-primary/20 p-4">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-neutral-600">Total Selected</span>
              <span className="text-sm font-bold text-neutral-900">{totalLinkedHours.toFixed(1)} hrs</span>
            </div>
            <div className="flex justify-between items-center pt-2 mt-1 border-t border-primary/20">
              <span className="text-xs text-neutral-600">Balance Remaining</span>
              <span className={`text-sm font-bold ${remainingHours <= 0 ? "text-green-600" : "text-red-500"}`}>
                {remainingHours.toFixed(1)} hrs
              </span>
            </div>
            {remainingHours <= 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-green-600 text-[14px]">check_circle</span>
                <p className="text-xs text-green-700 font-medium">Perfect match. You can now proceed.</p>
              </div>
            )}
            {remainingHours > 0 && (
              <div className="mt-3 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-500 text-[14px]">warning</span>
                <p className="text-xs text-amber-700">Select {remainingHours.toFixed(1)} more hours to cover your request.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3 (or 2 for non-LIL): Review */}
      {((step === 3 && isLil) || (step === 2 && !isLil)) && (
        <div className="rounded-xl bg-white border border-neutral-100 shadow-card p-6 space-y-5">
          <h3 className="text-sm font-semibold text-neutral-900">Review & Submit</h3>
          <div className="space-y-2">
            {[
              { label: "Leave Type", value: form.leave_type ? form.leave_type.charAt(0).toUpperCase() + form.leave_type.slice(1) + " Leave" : "—" },
              { label: "Duration", value: `${form.start_date} → ${form.end_date} (${daysRequested} days)` },
              { label: "Reason", value: form.reason || "Not provided" },
              ...(isLil ? [{ label: "LIL Hours Linked", value: `${totalLinkedHours.toFixed(1)} / ${hoursRequired.toFixed(1)} hrs` }] : []),
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between items-start py-2 border-b border-neutral-50">
                <span className="text-xs text-neutral-500 flex-shrink-0 w-40">{label}</span>
                <span className="text-xs font-medium text-neutral-900 text-right">{value}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-amber-500 text-[16px] mt-0.5">info</span>
            <p className="text-xs text-amber-700">This request will be sent to your supervisor for approval. Your leave balance will be updated once approved.</p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between pt-2">
        <div>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              className="inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Back
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => handleSubmit(true)}
            disabled={submitting}
            className="rounded-lg border border-neutral-200 bg-white px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-50 transition-colors disabled:opacity-50"
          >
            Save Draft
          </button>
          {/* Determine if this is the last step */}
          {!((step === 3 && isLil) || (step === 2 && !isLil)) ? (
            <button
              onClick={() => {
                // Skip LIL step if not LIL type
                if (!isLil && step === 1) {
                  setStep(3); // jump to review (but we render at step===2 for non-lil)
                  setStep(2);
                } else {
                  setStep((s) => s + 1);
                }
              }}
              disabled={!canNext()}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next Step
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          ) : (
            <button
              onClick={() => handleSubmit(false)}
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit Request"}
              <span className="material-symbols-outlined text-[18px]">send</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
