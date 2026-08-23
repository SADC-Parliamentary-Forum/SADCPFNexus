"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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
  leaveTypeOptionLabel,
  prefillLeaveEndDate,
  type LeaveBalancesPayload,
} from "@/lib/leaveBalances";
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
  const [showAwayDetails, setShowAwayDetails] = useState(false);
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
        if (entity.leave_address || entity.contact_number || entity.handover_required) {
          setShowAwayDetails(true);
        }
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
    return invalidIndex >= 0 ? `Segment ${invalidIndex + 1} ends before it starts.` : null;
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
  const holidaysExcluded = Number(preview?.segments.reduce((sum, row) => sum + Number(row.public_holidays_excluded ?? 0), 0) ?? 0);

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
    <div className="mx-auto max-w-3xl space-y-5">
      <ModulePageHeader
        title={editing ? "Edit leave request" : "New leave request"}
        subtitle="Choose the type, then the dates."
        breadcrumbs={
          <PageBreadcrumbs
            items={[{ label: "Leave", href: "/leave" }, { label: editing ? "Edit request" : "New request" }]}
          />
        }
      />

      {(previewError || submitError || dateValidationError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError ?? dateValidationError ?? previewError}
        </div>
      )}

      <FormSection title="What kind of leave?" icon="category">
        <LeaveBalanceStrip
          compact
          cards={balanceCards}
          loading={loadingLookups}
          year={balances?.period_year}
        />
        {segments.length === 1 ? (
          <FormField label="Leave type" required className="mt-4">
            <select
              className="form-input"
              value={primaryType ?? "annual"}
              disabled={loadingLookups}
              onChange={(event) => setPrimaryType(event.target.value)}
            >
              {leaveTypes.map((type) => (
                <option key={type.id} value={type.code}>
                  {leaveTypeOptionLabel(String(type.code), type.name, balanceCards)}
                </option>
              ))}
            </select>
          </FormField>
        ) : (
          <p className="mt-3 text-xs text-neutral-500">Pick the type on each period below.</p>
        )}
      </FormSection>

      <FormSection title="Leave period" icon="date_range">
        <div className="space-y-4">
          {segments.map((segment, index) => {
            const singleDay = Boolean(segment.start_date && segment.start_date === segment.end_date);
            const halfDay = segment.day_part === "morning" || segment.day_part === "afternoon";
            return (
              <div
                key={segment.uid}
                className={segments.length > 1 ? "rounded-lg border border-neutral-200 p-4" : undefined}
              >
                {segments.length > 1 ? (
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-neutral-800">Period {index + 1}</p>
                    <button
                      type="button"
                      onClick={() => removeSegment(segment.uid)}
                      className="text-xs font-semibold text-neutral-500 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {segments.length > 1 ? (
                    <FormField label="Leave type" required className="sm:col-span-2">
                      <select
                        className="form-input"
                        value={segment.leave_type}
                        disabled={loadingLookups}
                        onChange={(event) => updateSegment(segment.uid, { leave_type: event.target.value })}
                      >
                        {leaveTypes.map((type) => (
                          <option key={type.id} value={type.code}>
                            {leaveTypeOptionLabel(String(type.code), type.name, balanceCards)}
                          </option>
                        ))}
                      </select>
                    </FormField>
                  ) : null}

                  <FormField label="From" required>
                    <input
                      type="date"
                      className="form-input"
                      value={segment.start_date}
                      onChange={(event) => updateSegment(segment.uid, { start_date: event.target.value })}
                    />
                  </FormField>

                  <FormField
                    label="To"
                    required
                    error={hasInvalidDateRange(segment) ? "End date cannot be before start date." : undefined}
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
                </div>

                {singleDay ? (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      <input
                        type="checkbox"
                        checked={halfDay}
                        onChange={(event) =>
                          updateSegment(segment.uid, { day_part: event.target.checked ? "morning" : "full" })
                        }
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      Half day
                    </label>
                    {halfDay ? (
                      <select
                        className="form-input w-auto"
                        value={segment.day_part ?? "morning"}
                        onChange={(event) =>
                          updateSegment(segment.uid, { day_part: event.target.value as SegmentDraft["day_part"] })
                        }
                        aria-label="Half-day part"
                      >
                        <option value="morning">Morning</option>
                        <option value="afternoon">Afternoon</option>
                      </select>
                    ) : null}
                  </div>
                ) : null}

                {segment.leave_type === "lil" ? (
                  <FormField label="TOIL credit" className="mt-4" hint="Leave in lieu draws down an available credit.">
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
                ) : null}

                {segment.leave_type === "sick" ? (
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
                ) : null}
              </div>
            );
          })}

          <button type="button" onClick={addSegment} className="text-sm font-semibold text-primary hover:underline">
            Add another period
          </button>

          {preview ? (
            <p className="text-sm text-neutral-600">
              {formatLeaveDays(Number(preview.total_working_days ?? 0))}
              {holidaysExcluded > 0 ? ` · ${holidaysExcluded} ${holidaysExcluded === 1 ? "holiday" : "holidays"} excluded` : ""}
              {segments.length > 1
                ? ` · ${preview.segments.map((row) => leaveTypeName(row.leave_type, leaveTypes)).join(", ")}`
                : ""}
            </p>
          ) : completeForPreview ? null : (
            <p className="text-sm text-neutral-400">Working days appear after both dates are set.</p>
          )}
        </div>
      </FormSection>

      <FormSection title="While you are away" icon="description">
        <FormField label="Reason">
          <textarea
            rows={2}
            className="form-input resize-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>

        {showAwayDetails ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label="Contact number">
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
            <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 sm:col-span-2">
              <input
                type="checkbox"
                checked={handoverRequired}
                onChange={(event) => setHandoverRequired(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
              />
              Handover required
            </label>
            {handoverRequired ? (
              <FormField label="Handover notes" className="sm:col-span-2">
                <textarea
                  rows={2}
                  className="form-input resize-none"
                  value={handoverNotes}
                  onChange={(event) => setHandoverNotes(event.target.value)}
                />
              </FormField>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            className="mt-3 text-sm font-semibold text-primary hover:underline"
            onClick={() => setShowAwayDetails(true)}
          >
            Add contact and handover
          </button>
        )}
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <p className="text-sm text-neutral-600">
          {preview ? formatLeaveDays(Number(preview.total_working_days ?? 0)) : "Set the dates to submit"}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit(true)}
            className="btn-secondary disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit(false)}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveCreatePage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <LeaveCreatePageInner />
    </Suspense>
  );
}
