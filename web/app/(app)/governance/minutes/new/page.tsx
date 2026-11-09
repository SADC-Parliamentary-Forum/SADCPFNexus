"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { governanceMeetingTypeApi, minutesApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function splitNames(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function RecordMinutesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const toast = useToast();
  const { t } = useI18n();

  const [title, setTitle] = useState(searchParams.get("title") ?? "");
  const [meetingDate, setMeetingDate] = useState(searchParams.get("date") ?? "");
  const [location, setLocation] = useState("");
  const [meetingType, setMeetingType] = useState("");
  const [chairperson, setChairperson] = useState("");
  const [attendeesText, setAttendeesText] = useState("");
  const [apologiesText, setApologiesText] = useState("");
  const [notes, setNotes] = useState("");
  const [types, setTypes] = useState<Array<{ id: number; name: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const workplanEventId = Number(searchParams.get("workplan_event_id") ?? "");

  useEffect(() => {
    governanceMeetingTypeApi
      .list()
      .then((r) => {
        const rows = r.data.data ?? [];
        setTypes(rows);
        setMeetingType((current) => current || rows[0]?.name || "");
      })
      .catch(() => undefined);
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await minutesApi.create({
        title,
        meeting_date: meetingDate,
        location: location || null,
        meeting_type: meetingType || undefined,
        chairperson: chairperson || null,
        attendees: splitNames(attendeesText),
        apologies: splitNames(apologiesText),
        notes: notes || null,
        workplan_event_id: Number.isFinite(workplanEventId) && workplanEventId > 0 ? workplanEventId : null,
      });
      toast.success(t("governance.minutesNew.recorded"));
      router.push(`/governance/minutes/${res.data.data.id}`);
    } catch (err) {
      const message = apiErrorMessage(err, t("governance.minutesNew.failed"));
      setError(message);
      toast.error(t("governance.minutesNew.notRecorded"), message);
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("governance.minutesNew.title")}
        subtitle={t("governance.minutesNew.subtitle")}
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "governance.crumb", href: "/governance" },
              { label: "governance.minutesNew.title" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title={t("governance.minutesNew.meeting")} icon="meeting_room">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("governance.minutesNew.meetingTitle")} htmlFor="minutes-title" required className="sm:col-span-2">
              <input
                id="minutes-title"
                className="form-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("governance.minutesNew.titlePlaceholder")}
              />
            </FormField>
            <FormField label={t("governance.minutesNew.date")} htmlFor="minutes-date" required>
              <input
                id="minutes-date"
                type="date"
                className="form-input"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </FormField>
            <FormField label={t("governance.minutesNew.meetingType")} htmlFor="minutes-type">
              {types.length > 0 ? (
                <select
                  id="minutes-type"
                  className="form-input"
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                >
                  {types.map((mt) => (
                    <option key={mt.id} value={mt.name}>
                      {mt.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="minutes-type"
                  className="form-input"
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  placeholder={t("governance.minutesNew.typePlaceholder")}
                />
              )}
            </FormField>
            <FormField label={t("governance.minutesNew.location")} htmlFor="minutes-location">
              <input
                id="minutes-location"
                className="form-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder={t("governance.minutesNew.locationPlaceholder")}
              />
            </FormField>
            <FormField label={t("governance.minutesNew.chairperson")} htmlFor="minutes-chair">
              <input
                id="minutes-chair"
                className="form-input"
                value={chairperson}
                onChange={(e) => setChairperson(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("governance.minutesNew.attendance")} icon="groups">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t("governance.minutesNew.attendees")} htmlFor="minutes-attendees">
              <textarea
                id="minutes-attendees"
                className="form-input min-h-28 resize-y font-mono text-xs"
                value={attendeesText}
                onChange={(e) => setAttendeesText(e.target.value)}
                placeholder={"Ronald Windwaai\nJane Smith"} // i18n-ignore
              />
            </FormField>
            <FormField label={t("governance.minutesNew.apologies")} htmlFor="minutes-apologies">
              <textarea
                id="minutes-apologies"
                className="form-input min-h-28 resize-y font-mono text-xs"
                value={apologiesText}
                onChange={(e) => setApologiesText(e.target.value)}
                placeholder={t("governance.minutesNew.apologiesPlaceholder")}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title={t("governance.minutesNew.notes")} icon="description">
          <FormField label={t("governance.minutesNew.notesLabel")} htmlFor="minutes-notes">
            <textarea
              id="minutes-notes"
              className="form-input min-h-32 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("governance.minutesNew.notesPlaceholder")}
            />
          </FormField>
        </FormSection>

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
          <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !meetingDate}>
            {saving ? t("governance.minutesNew.saving") : t("governance.minutesNew.saveDraft")}
          </button>
          <Link href="/governance" className="btn-secondary">
            {t("common.cancel")}
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function RecordMinutesPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-w-0 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-48 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <RecordMinutesPageInner />
    </Suspense>
  );
}
