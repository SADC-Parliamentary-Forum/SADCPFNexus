"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { governanceMeetingTypeApi, minutesApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";

function splitNames(value: string): string[] {
  return value
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function RecordMinutesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

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
      router.push(`/governance/minutes/${res.data.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not record minutes. Check required fields and try again."));
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="Record minutes"
        subtitle="Capture the meeting, attendees, and a working draft of the notes."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Meetings & Minutes", href: "/governance" },
              { label: "Record minutes" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="Meeting" icon="meeting_room">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Meeting title" htmlFor="minutes-title" required className="sm:col-span-2">
              <input
                id="minutes-title"
                className="form-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Monthly Staff Meeting — March 2026"
              />
            </FormField>
            <FormField label="Date" htmlFor="minutes-date" required>
              <input
                id="minutes-date"
                type="date"
                className="form-input"
                required
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
              />
            </FormField>
            <FormField label="Meeting type" htmlFor="minutes-type">
              {types.length > 0 ? (
                <select
                  id="minutes-type"
                  className="form-input"
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                >
                  {types.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="minutes-type"
                  className="form-input"
                  value={meetingType}
                  onChange={(e) => setMeetingType(e.target.value)}
                  placeholder="e.g. ExCo, Plenary"
                />
              )}
            </FormField>
            <FormField label="Location / venue" htmlFor="minutes-location">
              <input
                id="minutes-location"
                className="form-input"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Conference Room A"
              />
            </FormField>
            <FormField label="Chairperson" htmlFor="minutes-chair">
              <input
                id="minutes-chair"
                className="form-input"
                value={chairperson}
                onChange={(e) => setChairperson(e.target.value)}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Attendance" icon="groups">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Attendees (one per line)" htmlFor="minutes-attendees">
              <textarea
                id="minutes-attendees"
                className="form-input min-h-28 resize-y font-mono text-xs"
                value={attendeesText}
                onChange={(e) => setAttendeesText(e.target.value)}
                placeholder={"Ronald Windwaai\nJane Smith"}
              />
            </FormField>
            <FormField label="Apologies (one per line)" htmlFor="minutes-apologies">
              <textarea
                id="minutes-apologies"
                className="form-input min-h-28 resize-y font-mono text-xs"
                value={apologiesText}
                onChange={(e) => setApologiesText(e.target.value)}
                placeholder={"Alice Brown (on leave)"}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Notes" icon="description">
          <FormField label="Meeting notes / summary" htmlFor="minutes-notes">
            <textarea
              id="minutes-notes"
              className="form-input min-h-32 resize-y"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Key discussion points, decisions taken, and any other relevant matters…"
            />
          </FormField>
        </FormSection>

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
          <button type="submit" className="btn-primary" disabled={saving || !title.trim() || !meetingDate}>
            {saving ? "Saving…" : "Save draft"}
          </button>
          <Link href="/governance" className="btn-secondary">
            Cancel
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
