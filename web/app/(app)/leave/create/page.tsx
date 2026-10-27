"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
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
  leaveTypeName,
  leaveTypeOptionLabel,
  prefillLeaveEndDate,
  type LeaveBalancesPayload,
} from "@/lib/leaveBalances";
import { LeaveBalanceStrip } from "@/components/leave/LeaveBalanceStrip";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useFormDraft } from "@/lib/useFormDraft";

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
  const { t } = useI18n();
  const daysText = (n: number) => {
    const count = Math.round(Number(n) * 100) / 100;
    return t(Math.abs(count) === 1 ? "leave.create.dayOne" : "leave.create.dayMany", { count });
  };
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

  // Autosave new requests locally; once created, retries update/submit the same
  // request instead of creating another one.
  const draftValue = useMemo(
    () => ({ segments, reason, leaveAddress, contactNumber, handoverRequired, handoverNotes }),
    [segments, reason, leaveAddress, contactNumber, handoverRequired, handoverNotes],
  );
  const draft = useFormDraft("leave.create", draftValue, { enabled: !editing });
  const createdIdRef = useRef<number | null>(null);
  const restoreDraft = () => {
    const v = draft.restore();
    if (!v) return;
    setSegments(v.segments?.length ? v.segments : [blankSegment()]);
    setReason(v.reason ?? "");
    setLeaveAddress(v.leaveAddress ?? "");
    setContactNumber(v.contactNumber ?? "");
    setHandoverRequired(Boolean(v.handoverRequired));
    setHandoverNotes(v.handoverNotes ?? "");
    if (v.leaveAddress || v.contactNumber || v.handoverRequired) setShowAwayDetails(true);
  };

  useEffect(() => {
    Promise.all([
      leaveApi.types().then((res) => setLeaveTypes(res.data.data)),
      leaveApi.listToil().then((res) => setToilCredits(res.data.data)),
      leaveApi.getBalances().then((res) => setBalances(res.data as LeaveBalancesPayload)),
    ])
      .catch(() => setPreviewError(t("leave.create.lookupError")))
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
      .catch(() => setSubmitError(t("leave.create.draftLoadError")));
  }, [editing, editId]);

  const dateValidationError = useMemo(() => {
    const invalidIndex = segments.findIndex(hasInvalidDateRange);
    return invalidIndex >= 0 ? t("leave.create.segmentInvalid", { n: invalidIndex + 1 }) : null;
  }, [segments, t]);

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
          setPreviewError(String(first ?? error?.response?.data?.message ?? t("leave.create.previewFailed")));
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
      const existingId = editing ? editId : createdIdRef.current;
      const res = existingId
        ? await leaveApi.update(existingId, header)
        : await leaveApi.create({ ...header, segments: toPayloadSegments() }, `${draft.operationKey}:create`);
      const created = res.data.data;
      createdIdRef.current = created.id;
      draft.clear();
      if (!asDraft) {
        await leaveApi.submit(created.id);
      }
      router.push(`/leave/${created.id}`);
    } catch (error: unknown) {
      const response = (error as { response?: { data?: { errors?: Record<string, string[]>; message?: string } } })
        ?.response?.data;
      const first = response?.errors ? Object.values(response.errors).flat()[0] : null;
      setSubmitError(String(first ?? response?.message ?? t("leave.create.saveFailed")));
      setSubmitting(false);
    }
  };

  const primaryType = segments[0]?.leave_type;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={editing ? t("leave.create.titleEdit") : t("leave.create.titleNew")}
        subtitle={t("leave.create.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[{ label: t("nav.leave"), href: "/leave" }, { label: editing ? t("leave.create.breadcrumbEdit") : t("leave.list.newRequest") }]}
          />
        }
      />

      {draft.restorable && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800" role="status">
          <span className="material-symbols-outlined text-[16px]">history</span>
          <span className="flex-1">{t("leave.create.draftFound", { when: new Date(draft.restorable.savedAt).toLocaleString() })}</span>
          <button type="button" className="btn-primary px-3 py-1.5 text-xs" onClick={restoreDraft}>{t("leave.create.draftRestore")}</button>
          <button type="button" className="btn-secondary px-3 py-1.5 text-xs" onClick={draft.discard}>{t("leave.create.draftDiscard")}</button>
        </div>
      )}

      {(previewError || submitError || dateValidationError) && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError ?? dateValidationError ?? previewError}
        </div>
      )}

      <FormSection title={t("leave.create.kind")} icon="category">
        <LeaveBalanceStrip
          compact
          cards={balanceCards}
          loading={loadingLookups}
          year={balances?.period_year}
        />
        {segments.length === 1 ? (
          <FormField label={t("leave.create.leaveType")} required className="mt-4">
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
          <p className="mt-3 text-xs text-neutral-500">{t("leave.create.pickPerPeriod")}</p>
        )}
      </FormSection>

      <FormSection title={t("leave.create.period")} icon="date_range">
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
                    <p className="text-sm font-semibold text-neutral-800">{t("leave.create.periodN", { n: index + 1 })}</p>
                    <button
                      type="button"
                      onClick={() => removeSegment(segment.uid)}
                      className="text-xs font-semibold text-neutral-500 hover:text-red-600"
                    >
                      {t("leave.create.remove")}
                    </button>
                  </div>
                ) : null}

                <div className="grid gap-4 sm:grid-cols-2">
                  {segments.length > 1 ? (
                    <FormField label={t("leave.create.leaveType")} required className="sm:col-span-2">
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

                  <FormField label={t("leave.create.from")} required>
                    <input
                      type="date"
                      className="form-input"
                      value={segment.start_date}
                      onChange={(event) => updateSegment(segment.uid, { start_date: event.target.value })}
                    />
                  </FormField>

                  <FormField
                    label={t("leave.create.to")}
                    required
                    error={hasInvalidDateRange(segment) ? t("leave.create.endBeforeStart") : undefined}
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
                    <label htmlFor="leave-create-updatesegment-segment-uid-classname-h-4-w-4-roun" className="flex items-center gap-2 text-sm text-neutral-700">
                      <input id="leave-create-updatesegment-segment-uid-classname-h-4-w-4-roun"
                        type="checkbox"
                        checked={halfDay}
                        onChange={(event) =>
                          updateSegment(segment.uid, { day_part: event.target.checked ? "morning" : "full" })
                        }
                        className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
                      />
                      {t("leave.create.halfDay")}
                    </label>
                    {halfDay ? (
                      <select
                        className="form-input w-auto"
                        value={segment.day_part ?? "morning"}
                        onChange={(event) =>
                          updateSegment(segment.uid, { day_part: event.target.value as SegmentDraft["day_part"] })
                        }
                        aria-label={t("leave.create.halfDayPart")}
                      >
                        <option value="morning">{t("leave.create.morning")}</option>
                        <option value="afternoon">{t("leave.create.afternoon")}</option>
                      </select>
                    ) : null}
                  </div>
                ) : null}

                {segment.leave_type === "lil" ? (
                  <FormField label={t("leave.create.toilCredit")} className="mt-4" hint={t("leave.create.toilHint")}>
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
                      <option value="">{t("leave.create.toilSelect")}</option>
                      {availableToilCredits.map((credit) => (
                        <option key={credit.id} value={credit.id}>
                          {t("leave.create.toilOption", {
                            ref: credit.credit_reference ?? "",
                            days: numberText(credit.remaining_balance),
                            date: credit.expiry_date ? formatDateShort(credit.expiry_date) : t("leave.create.notSet"),
                          })}
                        </option>
                      ))}
                    </select>
                  </FormField>
                ) : null}

                {segment.leave_type === "sick" ? (
                  <FormField
                    label={t("leave.create.medicalCert")}
                    className="mt-4"
                    hint={t("leave.create.medicalHint")}
                  >
                    <select
                      className="form-input"
                      value={segment.document_status ?? ""}
                      onChange={(event) =>
                        updateSegment(segment.uid, { document_status: event.target.value || null })
                      }
                    >
                      <option value="">{t("leave.create.cert.none")}</option>
                      <option value="not_required">{t("leave.create.cert.not_required")}</option>
                      <option value="complete">{t("leave.create.cert.complete")}</option>
                      <option value="restricted">{t("leave.create.cert.restricted")}</option>
                      <option value="missing">{t("leave.create.cert.missing")}</option>
                    </select>
                  </FormField>
                ) : null}
              </div>
            );
          })}

          <button type="button" onClick={addSegment} className="btn-secondary text-sm py-1 px-2">
            {t("leave.create.addPeriod")}
          </button>

          {preview ? (
            <p className="text-sm text-neutral-600">
              {daysText(Number(preview.total_working_days ?? 0))}
              {holidaysExcluded > 0
                ? t(holidaysExcluded === 1 ? "leave.create.holidaysOne" : "leave.create.holidaysMany", { count: holidaysExcluded })
                : ""}
              {segments.length > 1
                ? ` · ${preview.segments.map((row) => leaveTypeName(row.leave_type, leaveTypes)).join(", ")}`
                : ""}
            </p>
          ) : completeForPreview ? null : (
            <p className="text-sm text-neutral-400">{t("leave.create.daysPending")}</p>
          )}
        </div>
      </FormSection>

      <FormSection title={t("leave.create.away")} icon="description">
        <FormField label={t("leave.col.reason")}>
          <textarea
            rows={2}
            className="form-input resize-none"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </FormField>

        {showAwayDetails ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <FormField label={t("leave.create.contact")}>
              <input
                className="form-input"
                value={contactNumber}
                onChange={(event) => setContactNumber(event.target.value)}
              />
            </FormField>
            <FormField label={t("leave.create.address")}>
              <input
                className="form-input"
                value={leaveAddress}
                onChange={(event) => setLeaveAddress(event.target.value)}
              />
            </FormField>
            <label htmlFor="leave-create-sethandoverrequired-event-target-checked-classna" className="flex items-center gap-2 text-sm font-medium text-neutral-700 sm:col-span-2">
              <input id="leave-create-sethandoverrequired-event-target-checked-classna"
                type="checkbox"
                checked={handoverRequired}
                onChange={(event) => setHandoverRequired(event.target.checked)}
                className="h-4 w-4 rounded border-neutral-300 text-primary focus:ring-primary"
              />
              {t("leave.create.handoverRequired")}
            </label>
            {handoverRequired ? (
              <FormField label={t("leave.create.handoverNotes")} className="sm:col-span-2">
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
            className="btn-secondary text-sm py-1 px-2 mt-3"
            onClick={() => setShowAwayDetails(true)}
          >
            {t("leave.create.addAway")}
          </button>
        )}
      </FormSection>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4">
        <p className="text-sm text-neutral-600">
          {preview ? daysText(Number(preview.total_working_days ?? 0)) : t("leave.create.setDates")}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit(true)}
            className="btn-secondary disabled:opacity-50"
          >
            {t("leave.create.saveDraft")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit(false)}
            className="btn-primary disabled:opacity-50"
          >
            {submitting ? t("leave.create.submitting") : t("common.submit")}
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
        <div className="w-full min-w-0 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-24 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <LeaveCreatePageInner />
    </Suspense>
  );
}
