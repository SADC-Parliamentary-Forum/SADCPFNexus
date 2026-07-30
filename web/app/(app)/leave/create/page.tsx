"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  leaveApi,
  type LeavePreviewResponse,
  type LeaveSegmentInput,
  type LeaveType,
  type ToilCredit,
} from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";

type SegmentDraft = LeaveSegmentInput & { uid: string };

const TOIL_CREDIT_SOURCE = "App\\Models\\ToilCredit";

const TYPE_ICONS: Record<string, string> = {
  annual: "sunny",
  sick: "medical_services",
  lil: "swap_horiz",
  unpaid: "money_off",
  study: "school",
  home: "home",
  maternity: "child_care",
  paternity: "family_restroom",
  compassionate: "volunteer_activism",
  special: "star",
};

/** Brand-aligned type chips — avoid ad-hoc purple / rainbow marketing colors. */
const TYPE_COLORS: Record<string, string> = {
  annual: "text-green-700 bg-green-50 border-green-200",
  sick: "text-red-700 bg-red-50 border-red-200",
  lil: "text-primary bg-primary/10 border-primary/20",
  unpaid: "text-neutral-700 bg-neutral-50 border-neutral-200",
  study: "text-primary bg-primary/5 border-primary/20",
  home: "text-neutral-700 bg-neutral-50 border-neutral-200",
  maternity: "text-neutral-800 bg-neutral-50 border-neutral-200",
  paternity: "text-neutral-800 bg-neutral-50 border-neutral-200",
  compassionate: "text-amber-800 bg-amber-50 border-amber-200",
  special: "text-amber-800 bg-amber-50 border-amber-200",
};

function blankSegment(): SegmentDraft {
  return {
    uid: crypto.randomUUID(),
    leave_type: "annual",
    start_date: "",
    end_date: "",
    day_part: "full",
    source_type: null,
    source_id: null,
    document_status: null,
    comments: null,
  };
}

function typeLabel(types: LeaveType[], code: string): string {
  return types.find((type) => type.code === code)?.name ?? code.replace(/_/g, " ");
}

function numberText(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

export default function LeaveCreatePage() {
  const router = useRouter();
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [toilCredits, setToilCredits] = useState<ToilCredit[]>([]);
  const [segments, setSegments] = useState<SegmentDraft[]>([blankSegment()]);
  const [reason, setReason] = useState("");
  const [leaveAddress, setLeaveAddress] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [handoverRequired, setHandoverRequired] = useState(false);
  const [handoverNotes, setHandoverNotes] = useState("");
  const [preview, setPreview] = useState<LeavePreviewResponse | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingLookups, setLoadingLookups] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      leaveApi.types().then((res) => setLeaveTypes(res.data.data)),
      leaveApi.listToil().then((res) => setToilCredits(res.data.data)),
    ])
      .catch(() => setPreviewError("Leave settings could not be loaded."))
      .finally(() => setLoadingLookups(false));
  }, []);

  const completeForPreview = useMemo(
    () => segments.every((segment) => segment.leave_type && segment.start_date && segment.end_date),
    [segments],
  );

  useEffect(() => {
    if (!completeForPreview) {
      setPreview(null);
      setPreviewError(null);
      return;
    }

    const handle = window.setTimeout(() => {
      leaveApi.preview(toPayloadSegments())
        .then((res) => {
          setPreview(res.data.data);
          setPreviewError(null);
        })
        .catch((error) => {
          const errors = error?.response?.data?.errors;
          const first = errors ? Object.values(errors).flat()[0] : null;
          setPreview(null);
          setPreviewError(String(first ?? error?.response?.data?.message ?? "Preview failed."));
        });
    }, 350);

    return () => window.clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, completeForPreview]);

  const availableToilCredits = toilCredits.filter((credit) =>
    ["available", "partially_used", "extended"].includes(String(credit.status)) && Number(credit.remaining_balance) > 0,
  );

  const toPayloadSegments = (): LeaveSegmentInput[] =>
    segments.map(({ uid: _uid, ...segment }) => ({
      ...segment,
      source_type: segment.leave_type === "lil" && segment.source_id ? TOIL_CREDIT_SOURCE : null,
      source_id: segment.leave_type === "lil" ? segment.source_id ?? null : null,
      document_status: segment.document_status || null,
      comments: segment.comments || null,
    }));

  const updateSegment = (uid: string, patch: Partial<SegmentDraft>) => {
    setSegments((current) =>
      current.map((segment) => {
        if (segment.uid !== uid) return segment;
        const next = { ...segment, ...patch };
        if (patch.leave_type && patch.leave_type !== "lil") {
          next.source_type = null;
          next.source_id = null;
        }
        if (patch.leave_type === "lil") {
          next.source_type = TOIL_CREDIT_SOURCE;
        }
        return next;
      }),
    );
  };

  const addSegment = () => setSegments((current) => [...current, blankSegment()]);
  const removeSegment = (uid: string) => setSegments((current) => current.filter((segment) => segment.uid !== uid));

  const canSubmit = completeForPreview && !previewError && !submitting;

  const submit = async (asDraft: boolean) => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await leaveApi.create({
        reason: reason || undefined,
        leave_address: leaveAddress || undefined,
        contact_number: contactNumber || undefined,
        handover_required: handoverRequired,
        handover_notes: handoverNotes || undefined,
        segments: toPayloadSegments(),
      });
      const created = res.data.data;
      if (!asDraft) {
        await leaveApi.submit(created.id);
      }
      router.push(`/leave/${created.id}`);
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      const first = errors ? Object.values(errors).flat()[0] : null;
      setSubmitError(String(first ?? error?.response?.data?.message ?? "Leave request could not be saved."));
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="New Leave Request"
        subtitle="Create one application with one or more leave segments."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Leave", href: "/leave" }, { label: "New request" }]} />}
        actions={
          <Link href="/leave" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
        }
      />

      {(previewError || submitError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError ?? previewError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <FormSection
            title="Segments"
            description="Working days are calculated by the server from the dates you enter."
            icon="view_week"
            actions={
              <button type="button" onClick={addSegment} className="btn-secondary py-2 text-xs">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Segment
              </button>
            }
          >

            <div className="space-y-4">
              {segments.map((segment, index) => {
                const previewSegment = preview?.segments[index];
                const color = TYPE_COLORS[segment.leave_type] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
                return (
                  <div key={segment.uid} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}>
                        <span className="material-symbols-outlined text-[14px]">{TYPE_ICONS[segment.leave_type] ?? "event_available"}</span>
                        Segment {index + 1}
                      </span>
                      {segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSegment(segment.uid)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove segment ${index + 1}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">Leave type</span>
                        <select
                          className="form-input"
                          value={segment.leave_type}
                          disabled={loadingLookups}
                          onChange={(event) => updateSegment(segment.uid, { leave_type: event.target.value })}
                        >
                          {leaveTypes.map((type) => (
                            <option key={type.id} value={type.code}>{type.name}</option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">Day part</span>
                        <select
                          className="form-input"
                          value={segment.day_part ?? "full"}
                          onChange={(event) => updateSegment(segment.uid, { day_part: event.target.value as SegmentDraft["day_part"] })}
                        >
                          <option value="full">Full day</option>
                          <option value="morning">Morning half-day</option>
                          <option value="afternoon">Afternoon half-day</option>
                        </select>
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">From</span>
                        <input
                          type="date"
                          className="form-input"
                          value={segment.start_date}
                          onChange={(event) => updateSegment(segment.uid, { start_date: event.target.value })}
                        />
                      </label>

                      <label className="space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">To and including</span>
                        <input
                          type="date"
                          className="form-input"
                          value={segment.end_date}
                          onChange={(event) => updateSegment(segment.uid, { end_date: event.target.value })}
                        />
                      </label>
                    </div>

                    {segment.leave_type === "lil" && (
                      <label className="mt-4 block space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">TOIL credit</span>
                        <select
                          className="form-input"
                          value={segment.source_id ?? ""}
                          onChange={(event) => updateSegment(segment.uid, {
                            source_type: TOIL_CREDIT_SOURCE,
                            source_id: event.target.value ? Number(event.target.value) : null,
                          })}
                        >
                          <option value="">Select available TOIL credit</option>
                          {availableToilCredits.map((credit) => (
                            <option key={credit.id} value={credit.id}>
                              {credit.credit_reference} - {numberText(credit.remaining_balance)} days, expires {credit.expiry_date ?? "not set"}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}

                    {segment.leave_type === "sick" && (
                      <label className="mt-4 block space-y-1.5">
                        <span className="text-xs font-semibold text-neutral-600">Medical certificate status</span>
                        <select
                          className="form-input"
                          value={segment.document_status ?? ""}
                          onChange={(event) => updateSegment(segment.uid, { document_status: event.target.value || null })}
                        >
                          <option value="">Not recorded</option>
                          <option value="not_required">Not required</option>
                          <option value="complete">Provided</option>
                          <option value="restricted">Provided - restricted</option>
                          <option value="missing">Missing</option>
                        </select>
                      </label>
                    )}

                    <label className="mt-4 block space-y-1.5">
                      <span className="text-xs font-semibold text-neutral-600">Segment comments</span>
                      <textarea
                        rows={2}
                        className="form-input resize-none"
                        value={segment.comments ?? ""}
                        onChange={(event) => updateSegment(segment.uid, { comments: event.target.value || null })}
                      />
                    </label>

                    {previewSegment && (
                      <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-4">
                        {[
                          { label: "Calendar", value: numberText(previewSegment.calendar_days) },
                          { label: "Working", value: numberText(previewSegment.amount_requested) },
                          { label: "Holidays", value: numberText(previewSegment.public_holidays_excluded) },
                          { label: "Balance after", value: numberText(previewSegment.balance_after) },
                        ].map((item) => (
                          <div key={item.label} className="rounded-lg bg-neutral-50 px-3 py-2">
                            <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">{item.label}</p>
                            <p className="mt-0.5 text-sm font-bold text-neutral-900">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </FormSection>

          <FormSection title="Application details" icon="description">
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-xs font-semibold text-neutral-600">Reason</span>
                <textarea
                  rows={3}
                  className="form-input resize-none"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-neutral-600">Leave contact number</span>
                <input className="form-input" value={contactNumber} onChange={(event) => setContactNumber(event.target.value)} />
              </label>
              <label className="space-y-1.5">
                <span className="text-xs font-semibold text-neutral-600">Leave address</span>
                <input className="form-input" value={leaveAddress} onChange={(event) => setLeaveAddress(event.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700">
                <input
                  type="checkbox"
                  checked={handoverRequired}
                  onChange={(event) => setHandoverRequired(event.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                />
                Handover required
              </label>
              {handoverRequired && (
                <label className="space-y-1.5 md:col-span-2">
                  <span className="text-xs font-semibold text-neutral-600">Handover notes</span>
                  <textarea
                    rows={2}
                    className="form-input resize-none"
                    value={handoverNotes}
                    onChange={(event) => setHandoverNotes(event.target.value)}
                  />
                </label>
              )}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-4">
          <FormSection
            title="Server preview"
            description={preview ? `${preview.segments.length} segment${preview.segments.length !== 1 ? "s" : ""}` : "Waiting for dates"}
            icon="fact_check"
            dense
          >
            <div className="space-y-3">
              {preview?.segments.map((segment, index) => (
                <div key={`${segment.leave_type}-${index}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{typeLabel(leaveTypes, segment.leave_type)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatDateShort(segment.start_date)} - {formatDateShort(segment.end_date)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary">{numberText(segment.amount_requested)}</span>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-primary/5 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">Total working days</span>
                  <span className="text-xl font-bold text-primary">{numberText(preview?.total_working_days)}</span>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Available TOIL" icon="schedule" dense>
            <div className="space-y-2">
              {availableToilCredits.length === 0 ? (
                <p className="text-xs text-neutral-400">No available TOIL credits.</p>
              ) : availableToilCredits.slice(0, 4).map((credit) => (
                <div key={credit.id} className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-primary">{credit.credit_reference}</span>
                    <span className="text-xs font-semibold text-neutral-800">{numberText(credit.remaining_balance)} days</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-neutral-500">Expires {credit.expiry_date ?? "not set"}</p>
                </div>
              ))}
            </div>
          </FormSection>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit(true)}
              className="btn-secondary flex-1 justify-center disabled:opacity-50"
            >
              Save Draft
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit(false)}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
