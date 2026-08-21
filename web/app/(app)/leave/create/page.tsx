"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  leaveApi,
  type LeavePreviewResponse,
  type LeaveRequest,
  type LeaveSegmentInput,
  type LeaveType,
  type LeaveTypeCode,
  type ToilCredit,
} from "@/lib/api";
import { unwrapEntity } from "@/lib/unwrapEntity";
import { formatDateShort } from "@/lib/utils";
import {
  categorizeLeaveBalances,
  formatLeaveDays,
  leaveTypeName,
  prefillLeaveEndDate,
  type LeaveBalancesPayload,
} from "@/lib/leaveBalances";
import { LEAVE_TYPE_COLORS, LEAVE_TYPE_ICONS } from "@/lib/leaveHub";
import { LeaveBalanceStrip } from "@/components/leave/LeaveBalanceStrip";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";

type SegmentDraft = LeaveSegmentInput & { uid: string };

const TOIL_CREDIT_SOURCE = "App\\Models\\ToilCredit";

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

function numberText(value: unknown): string {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}

function hasInvalidDateRange(segment: Pick<SegmentDraft, "start_date" | "end_date">): boolean {
  return Boolean(segment.start_date && segment.end_date && segment.end_date < segment.start_date);
}

function LeaveCreatePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = Number(searchParams.get("edit") ?? "");
  const editing = Number.isFinite(editId) && editId > 0;

  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [toilCredits, setToilCredits] = useState<ToilCredit[]>([]);
  const [balances, setBalances] = useState<LeaveBalancesPayload | null>(null);
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
      leaveApi.getBalances().then((res) => setBalances(res.data as LeaveBalancesPayload)),
    ])
      .catch(() => setPreviewError("Leave settings could not be loaded."))
      .finally(() => setLoadingLookups(false));
  }, []);

  useEffect(() => {
    if (!editing) return;
    leaveApi
      .get(editId)
      .then((res) => {
        const entity = unwrapEntity<LeaveRequest>(res.data);
        if (!entity) return;
        setReason(entity.reason ?? "");
        setLeaveAddress(entity.leave_address ?? "");
        setContactNumber(entity.contact_number ?? "");
        setHandoverRequired(Boolean(entity.handover_required));
        setHandoverNotes(entity.handover_notes ?? "");
        if (entity.segments && entity.segments.length > 0) {
          setSegments(
            entity.segments.map((segment) => ({
              uid: crypto.randomUUID(),
              leave_type: String(segment.leave_type),
              start_date: String(segment.start_date ?? "").slice(0, 10),
              end_date: String(segment.end_date ?? "").slice(0, 10),
              day_part: (segment.day_part as SegmentDraft["day_part"]) ?? "full",
              source_type: segment.source_type ?? null,
              source_id: segment.source_id ?? null,
              document_status: segment.document_status ?? null,
              comments: segment.comments ?? null,
            })),
          );
        } else {
          setSegments([
            {
              ...blankSegment(),
              leave_type: entity.leave_type,
              start_date: String(entity.start_date ?? "").slice(0, 10),
              end_date: String(entity.end_date ?? "").slice(0, 10),
            },
          ]);
        }
      })
      .catch(() => setSubmitError("This draft could not be loaded."));
  }, [editing, editId]);

  const dateValidationError = useMemo(() => {
    const invalidIndex = segments.findIndex(hasInvalidDateRange);
    return invalidIndex >= 0 ? `Period ${invalidIndex + 1} ends before it starts.` : null;
  }, [segments]);

  const completeForPreview = useMemo(
    () => segments.every((segment) => segment.leave_type && segment.start_date && segment.end_date),
    [segments],
  );

  useEffect(() => {
    if (dateValidationError || !completeForPreview) {
      setPreview(null);
      if (!dateValidationError) setPreviewError(null);
      return;
    }

    const handle = window.setTimeout(() => {
      leaveApi
        .preview(toPayloadSegments())
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
  }, [segments, completeForPreview, dateValidationError]);

  const availableToilCredits = toilCredits.filter(
    (credit) =>
      ["available", "partially_used", "extended"].includes(String(credit.status)) &&
      Number(credit.remaining_balance) > 0,
  );

  const balanceCards = useMemo(
    () =>
      categorizeLeaveBalances(
        balances,
        leaveTypes.map((type) => ({ code: String(type.code), name: type.name })),
      ),
    [balances, leaveTypes],
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
        if (patch.start_date != null) {
          next.end_date = prefillLeaveEndDate(patch.start_date, next.end_date);
        }
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

  const setPrimaryType = (code: string) => {
    const target = segments[0];
    if (target) updateSegment(target.uid, { leave_type: code });
  };

  const addSegment = () => setSegments((current) => [...current, blankSegment()]);
  const removeSegment = (uid: string) => setSegments((current) => current.filter((segment) => segment.uid !== uid));

  const canSubmit = completeForPreview && !dateValidationError && !previewError && !submitting;

  const submit = async (asDraft: boolean) => {
    if (dateValidationError) {
      setSubmitError(dateValidationError);
      return;
    }
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const header = {
        reason: reason || undefined,
        leave_address: leaveAddress || undefined,
        contact_number: contactNumber || undefined,
        handover_required: handoverRequired,
        handover_notes: handoverNotes || undefined,
        leave_type: segments[0]?.leave_type as LeaveTypeCode | undefined,
        start_date: segments[0]?.start_date,
        end_date: segments[0]?.end_date,
      };
      const res = editing
        ? await leaveApi.update(editId, header)
        : await leaveApi.create({ ...header, segments: toPayloadSegments() });
      const created = res.data.data;
      if (!asDraft) {
        await leaveApi.submit(created.id);
      }
      router.push(`/leave/${created.id}`);
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } })
        ?.response?.data;
      const first = response?.errors ? Object.values(response.errors).flat()[0] : null;
      setSubmitError(String(first ?? response?.message ?? "Leave request could not be saved."));
      setSubmitting(false);
    }
  };

  const primaryType = segments[0]?.leave_type;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title={editing ? "Edit leave request" : "New leave request"}
        subtitle="Pick a leave type, then the days you need. Remaining balances are shown before you submit."
        breadcrumbs={
          <PageBreadcrumbs
            items={[{ label: "Leave", href: "/leave" }, { label: editing ? "Edit request" : "New request" }]}
          />
        }
        actions={
          <Link href="/leave" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Back
          </Link>
        }
      />

      <LeaveBalanceStrip
        cards={balanceCards}
        loading={loadingLookups}
        year={balances?.period_year}
        selectedCode={primaryType}
        onSelect={setPrimaryType}
      />

      {(previewError || submitError || dateValidationError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError ?? dateValidationError ?? previewError}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-5">
          <FormSection
            title="What kind of leave?"
            description="Your remaining days for that type stay visible above. Choose one type per period."
            icon="category"
          >
            <div className="flex flex-wrap gap-2">
              {(leaveTypes.length > 0
                ? leaveTypes.map((type) => ({ code: String(type.code), name: type.name }))
                : balanceCards.map((card) => ({ code: card.code, name: card.name }))
              ).map((type) => {
                const code = type.code;
                const name = type.name;
                const selected = primaryType === code && segments.length === 1;
                const remaining = balanceCards.find((card) => card.code === code);
                const color = LEAVE_TYPE_COLORS[code] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
                return (
                  <button
                    key={code}
                    type="button"
                    disabled={loadingLookups || segments.length > 1}
                    onClick={() => setPrimaryType(code)}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${color} ${
                      selected ? "ring-2 ring-primary ring-offset-1" : ""
                    } disabled:opacity-60`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {LEAVE_TYPE_ICONS[code] ?? "event_available"}
                    </span>
                    {name}
                    {remaining ? (
                      <span className="font-normal text-neutral-500">
                        {remaining.headline === "used"
                          ? `${formatLeaveDays(remaining.used)} used`
                          : formatLeaveDays(remaining.remaining)}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
            {segments.length > 1 ? (
              <p className="mt-3 text-xs text-neutral-500">
                Several periods are on this request — pick the type on each period below.
              </p>
            ) : null}
          </FormSection>

          <FormSection
            title="Leave period"
            description="Working days exclude weekends and public holidays. A single day is From and To on the same date."
            icon="date_range"
            actions={
              <button type="button" onClick={addSegment} className="btn-secondary py-2 text-xs">
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add another period
              </button>
            }
          >
            <div className="space-y-4">
              {segments.map((segment, index) => {
                const previewSegment = preview?.segments[index];
                const color = LEAVE_TYPE_COLORS[segment.leave_type] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
                const remaining = balanceCards.find((card) => card.code === segment.leave_type);
                return (
                  <div key={segment.uid} className="rounded-lg border border-neutral-200 bg-white p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${color}`}>
                        <span className="material-symbols-outlined text-[14px]">
                          {LEAVE_TYPE_ICONS[segment.leave_type] ?? "event_available"}
                        </span>
                        Period {index + 1}
                      </span>
                      {segments.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeSegment(segment.uid)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove period ${index + 1}`}
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      )}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      {segments.length > 1 ? (
                        <FormField label="Leave type" required>
                          <select
                            className="form-input"
                            value={segment.leave_type}
                            disabled={loadingLookups}
                            onChange={(event) => updateSegment(segment.uid, { leave_type: event.target.value })}
                          >
                            {leaveTypes.map((type) => (
                              <option key={type.id} value={type.code}>
                                {type.name}
                              </option>
                            ))}
                          </select>
                        </FormField>
                      ) : (
                        <div className="rounded-lg bg-neutral-50 px-3 py-2 md:col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-400">Selected type</p>
                          <p className="text-sm font-semibold text-neutral-900">
                            {leaveTypeName(segment.leave_type, leaveTypes)}
                            {remaining?.headline === "remaining"
                              ? ` · ${formatLeaveDays(remaining.remaining)} remaining`
                              : remaining?.headline === "used"
                                ? ` · ${formatLeaveDays(remaining.used)} used this year`
                                : ""}
                          </p>
                        </div>
                      )}

                      <FormField label="From" required>
                        <input
                          type="date"
                          className="form-input"
                          value={segment.start_date}
                          onChange={(event) => updateSegment(segment.uid, { start_date: event.target.value })}
                        />
                      </FormField>

                      <FormField
                        label="To and including"
                        required
                        error={hasInvalidDateRange(segment) ? "End date cannot be before start date." : undefined}
                        hint="Same as From for a single day."
                      >
                        <input
                          type="date"
                          className="form-input"
                          value={segment.end_date}
                          min={segment.start_date || undefined}
                          onChange={(event) => updateSegment(segment.uid, { end_date: event.target.value })}
                          aria-invalid={hasInvalidDateRange(segment) || undefined}
                        />
                      </FormField>

                      <FormField label="Day part">
                        <select
                          className="form-input"
                          value={segment.day_part ?? "full"}
                          onChange={(event) =>
                            updateSegment(segment.uid, { day_part: event.target.value as SegmentDraft["day_part"] })
                          }
                        >
                          <option value="full">Full day</option>
                          <option value="morning">Morning half-day</option>
                          <option value="afternoon">Afternoon half-day</option>
                        </select>
                      </FormField>
                    </div>

                    {segment.leave_type === "lil" && (
                      <FormField
                        label="TOIL credit"
                        className="mt-4"
                        hint="Leave in lieu draws down an available credit."
                      >
                        <select
                          className="form-input"
                          value={segment.source_id ?? ""}
                          onChange={(event) =>
                            updateSegment(segment.uid, {
                              source_type: TOIL_CREDIT_SOURCE,
                              source_id: event.target.value ? Number(event.target.value) : null,
                            })
                          }
                        >
                          <option value="">Select available TOIL credit</option>
                          {availableToilCredits.map((credit) => (
                            <option key={credit.id} value={credit.id}>
                              {credit.credit_reference} — {numberText(credit.remaining_balance)} days, expires{" "}
                              {credit.expiry_date ? formatDateShort(credit.expiry_date) : "not set"}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    )}

                    {segment.leave_type === "sick" && (
                      <FormField
                        label="Medical certificate"
                        className="mt-4"
                        hint="HR may ask for a certificate depending on the number of days."
                      >
                        <select
                          className="form-input"
                          value={segment.document_status ?? ""}
                          onChange={(event) =>
                            updateSegment(segment.uid, { document_status: event.target.value || null })
                          }
                        >
                          <option value="">Not recorded yet</option>
                          <option value="not_required">Not required</option>
                          <option value="complete">Provided</option>
                          <option value="restricted">Provided — restricted</option>
                          <option value="missing">Missing</option>
                        </select>
                      </FormField>
                    )}

                    <FormField label="Notes for this period" className="mt-4">
                      <textarea
                        rows={2}
                        className="form-input resize-none"
                        value={segment.comments ?? ""}
                        onChange={(event) => updateSegment(segment.uid, { comments: event.target.value || null })}
                      />
                    </FormField>

                    {previewSegment && (
                      <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-4">
                        {[
                          { label: "Calendar days", value: numberText(previewSegment.calendar_days) },
                          { label: "Working days", value: numberText(previewSegment.amount_requested) },
                          { label: "Holidays excluded", value: numberText(previewSegment.public_holidays_excluded) },
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

          <FormSection title="While you are away" icon="description">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Reason" className="md:col-span-2">
                <textarea
                  rows={3}
                  className="form-input resize-none"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                />
              </FormField>
              <FormField label="Contact number while on leave">
                <input
                  className="form-input"
                  value={contactNumber}
                  onChange={(event) => setContactNumber(event.target.value)}
                />
              </FormField>
              <FormField label="Address while on leave">
                <input
                  className="form-input"
                  value={leaveAddress}
                  onChange={(event) => setLeaveAddress(event.target.value)}
                />
              </FormField>
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
                <FormField label="Handover notes" className="md:col-span-2">
                  <textarea
                    rows={2}
                    className="form-input resize-none"
                    value={handoverNotes}
                    onChange={(event) => setHandoverNotes(event.target.value)}
                  />
                </FormField>
              )}
            </div>
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-6">
          <FormSection
            title="This request"
            description={
              preview
                ? `${preview.segments.length} period${preview.segments.length !== 1 ? "s" : ""}`
                : "Enter dates to see working days"
            }
            icon="fact_check"
            dense
          >
            <div className="space-y-3">
              {preview?.segments.map((segment, index) => (
                <div key={`${segment.leave_type}-${index}`} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-neutral-900">{leaveTypeName(segment.leave_type, leaveTypes)}</p>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        {formatDateShort(segment.start_date)} – {formatDateShort(segment.end_date)}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-primary">
                      {formatLeaveDays(Number(segment.amount_requested))}
                    </span>
                  </div>
                </div>
              ))}

              <div className="rounded-lg bg-primary/5 px-3 py-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-neutral-600">Total working days</span>
                  <span className="text-xl font-bold text-primary">
                    {formatLeaveDays(Number(preview?.total_working_days ?? 0))}
                  </span>
                </div>
              </div>
            </div>
          </FormSection>

          <FormSection title="Available TOIL" icon="schedule" dense>
            <div className="space-y-2">
              {availableToilCredits.length === 0 ? (
                <p className="text-xs text-neutral-400">No available TOIL credits.</p>
              ) : (
                availableToilCredits.slice(0, 4).map((credit) => (
                  <div key={credit.id} className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-primary">{credit.credit_reference}</span>
                      <span className="text-xs font-semibold text-neutral-800">
                        {formatLeaveDays(Number(credit.remaining_balance))}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-neutral-500">
                      Expires {credit.expiry_date ? formatDateShort(credit.expiry_date) : "not set"}
                    </p>
                  </div>
                ))
              )}
            </div>
          </FormSection>

          <div className="flex gap-3">
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit(true)}
              className="btn-secondary flex-1 justify-center disabled:opacity-50"
            >
              Save draft
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={() => void submit(false)}
              className="btn-primary flex-1 justify-center disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function LeaveCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-6xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <LeaveCreatePageInner />
    </Suspense>
  );
}
