"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { decisionsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";

function CreateDecisionPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const minutesFromQuery = searchParams.get("minutes") ?? "";

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [decisionType, setDecisionType] = useState<"resolution" | "management_decision">("resolution");
  const [dueDate, setDueDate] = useState("");
  const [confidential, setConfidential] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [minutesId, setMinutesId] = useState(minutesFromQuery);
  const [agendaTitle, setAgendaTitle] = useState("");
  const [owners, setOwners] = useState<Array<{ id: number; name: string }>>([]);
  const [minutes, setMinutes] = useState<Array<{ id: number; title: string; meeting_date?: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    decisionsApi.listOwners().then((r) => setOwners(r.data.data ?? [])).catch(() => undefined);
    decisionsApi.listMinutesOptions().then((r) => setMinutes(r.data.data ?? [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (minutesFromQuery) setMinutesId(minutesFromQuery);
  }, [minutesFromQuery]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await decisionsApi.create({
        title,
        body: body || null,
        decision_type: decisionType,
        due_date: dueDate || null,
        is_confidential: confidential,
        owner_id: ownerId ? Number(ownerId) : null,
        meeting_minutes_id: minutesId ? Number(minutesId) : null,
      });
      const decisionId = res.data.data.id;
      if (agendaTitle.trim()) {
        const agenda = await decisionsApi.createAgendaItem({
          title: agendaTitle.trim(),
          meeting_minutes_id: minutesId ? Number(minutesId) : null,
          meeting_decision_id: decisionId,
        });
        await decisionsApi.linkAgendaDecision(agenda.data.data.id, decisionId);
      }
      router.push(`/decisions/${decisionId}`);
    } catch (err) {
      setError(apiErrorMessage(err, "Could not create the decision. Check required fields and try again."));
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="New decision"
        subtitle="Capture a meeting resolution or management decision as a draft."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Governance", href: "/governance" },
              { label: "Decision Register", href: "/decisions" },
              { label: "New decision" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="Decision" icon="gavel" description="Type and wording of the decision.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Type" htmlFor="decision-type" required>
              <select
                id="decision-type"
                className="form-input"
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value as typeof decisionType)}
              >
                <option value="resolution">Resolution</option>
                <option value="management_decision">Management decision</option>
              </select>
            </FormField>
            <FormField label="Due date" htmlFor="decision-due">
              <input
                id="decision-due"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>
            <FormField label="Title" htmlFor="decision-title" required className="sm:col-span-2">
              <input
                id="decision-title"
                className="form-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short decision title"
              />
            </FormField>
            <FormField label="Decision text" htmlFor="decision-body" className="sm:col-span-2">
              <textarea
                id="decision-body"
                className="form-input min-h-32 resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Full wording of the resolution or decision"
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="Ownership and meeting" icon="groups" description="Who owns follow-up, and which minutes this belongs to.">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Owner" htmlFor="decision-owner">
              <select
                id="decision-owner"
                className="form-input"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">Select owner…</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Meeting minutes" htmlFor="decision-minutes">
              <select
                id="decision-minutes"
                className="form-input"
                value={minutesId}
                onChange={(e) => setMinutesId(e.target.value)}
              >
                <option value="">Optional minutes link…</option>
                {minutes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                    {m.meeting_date ? ` (${String(m.meeting_date).slice(0, 10)})` : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="Agenda item (optional)"
              htmlFor="decision-agenda"
              hint="Creates and links an agenda item on the selected minutes."
              className="sm:col-span-2"
            >
              <input
                id="decision-agenda"
                className="form-input"
                placeholder="Agenda item title"
                value={agendaTitle}
                onChange={(e) => setAgendaTitle(e.target.value)}
              />
            </FormField>
            <label htmlFor="decision-confidential" className="flex items-center gap-2 text-sm text-neutral-700 sm:col-span-2">
              <input
                id="decision-confidential"
                type="checkbox"
                className="h-4 w-4 rounded border-neutral-300 text-primary"
                checked={confidential}
                onChange={(e) => setConfidential(e.target.checked)}
              />
              Mark confidential
            </label>
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? "Saving…" : "Create draft"}
          </button>
          <Link href="/decisions" className="btn-secondary">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}

export default function CreateDecisionPage() {
  return (
    <Suspense
      fallback={
        <div className="w-full min-w-0 space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-neutral-100" />
          <div className="h-48 animate-pulse rounded-xl bg-neutral-100" />
        </div>
      }
    >
      <CreateDecisionPageInner />
    </Suspense>
  );
}
