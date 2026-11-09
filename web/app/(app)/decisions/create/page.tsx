"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { decisionsApi } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function CreateDecisionPageInner() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
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
      toast.success(t("decisions.create.created"));
      router.push(`/decisions/${decisionId}`);
    } catch (err) {
      const message = apiErrorMessage(err, t("decisions.create.failed"));
      setError(message);
      toast.error(t("decisions.create.notCreated"), message);
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="decisions.new"
        subtitle="decisions.create.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "decisions.crumb.governance", href: "/governance" },
              { label: "decisions.register.title", href: "/decisions" },
              { label: "decisions.new" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <form onSubmit={onSubmit} className="space-y-5">
        <FormSection title="decisions.detail.title" icon="gavel" description="decisions.create.decisionHint">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="decisions.col.type" htmlFor="decision-type" required>
              <select
                id="decision-type"
                className="form-input"
                value={decisionType}
                onChange={(e) => setDecisionType(e.target.value as typeof decisionType)}
              >
                <option value="resolution">{t("decisions.type.resolution")}</option>
                <option value="management_decision">{t("decisions.type.management_decision")}</option>
              </select>
            </FormField>
            <FormField label="decisions.create.dueDate" htmlFor="decision-due">
              <input
                id="decision-due"
                type="date"
                className="form-input"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </FormField>
            <FormField label="decisions.col.title" htmlFor="decision-title" required className="sm:col-span-2">
              <input
                id="decision-title"
                className="form-input"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("decisions.create.titlePlaceholder")}
              />
            </FormField>
            <FormField label="decisions.detail.text" htmlFor="decision-body" className="sm:col-span-2">
              <textarea
                id="decision-body"
                className="form-input min-h-32 resize-y"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t("decisions.create.bodyPlaceholder")}
              />
            </FormField>
          </div>
        </FormSection>

        <FormSection title="decisions.create.ownership" icon="groups" description="decisions.create.ownershipHint">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="decisions.col.owner" htmlFor="decision-owner">
              <select
                id="decision-owner"
                className="form-input"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
              >
                <option value="">{t("decisions.create.selectOwner")}</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="decisions.create.minutes" htmlFor="decision-minutes">
              <select
                id="decision-minutes"
                className="form-input"
                value={minutesId}
                onChange={(e) => setMinutesId(e.target.value)}
              >
                <option value="">{t("decisions.create.minutesOptional")}</option>
                {minutes.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                    {m.meeting_date ? ` (${String(m.meeting_date).slice(0, 10)})` : ""}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField
              label="decisions.create.agenda"
              htmlFor="decision-agenda"
              hint="decisions.create.agendaHint"
              className="sm:col-span-2"
            >
              <input
                id="decision-agenda"
                className="form-input"
                placeholder={t("decisions.create.agendaPlaceholder")}
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
              {t("decisions.create.markConfidential")}
            </label>
          </div>
        </FormSection>

        <div className="flex flex-wrap gap-2 border-t border-neutral-200 pt-4">
          <button type="submit" className="btn-primary" disabled={saving || !title.trim()}>
            {saving ? t("decisions.create.saving") : t("decisions.create.submit")}
          </button>
          <Link href="/decisions" className="btn-secondary">
            {t("common.cancel")}
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
