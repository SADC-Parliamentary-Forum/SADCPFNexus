"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function RecurringAssignmentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const { t } = useI18n();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_date: defaultDueDate(),
    frequency: "weekly",
    interval: "1",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["assignments", "templates"],
    queryFn: async () => {
      const res = await assignmentsApi.list({ per_page: "100", templates_only: "true" });
      const body = res.data as { data?: Assignment[] };
      return body.data ?? [];
    },
  });

  const generate = useMutation({
    mutationFn: (id: number) => assignmentsApi.generateFromTemplate(id),
    onSuccess: () => {
      setMsg(t("assignments.recurring.generated"));
      setErr(null);
      toast.success(t("assignments.recurring.toast.generated"), t("assignments.recurring.generated"));
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: (error) => {
      setErr(t("assignments.recurring.generateFailed"));
      toast.error(t("assignments.recurring.toast.generateFailed"), apiErrorMessage(error, t("assignments.recurring.generateFailed")));
    },
  });

  const create = useMutation({
    mutationFn: () =>
      assignmentsApi.createTemplate({
        title: form.title.trim(),
        description: form.description.trim(),
        due_date: form.due_date,
        recurrence_rule: {
          frequency: form.frequency,
          interval: Number(form.interval) || 1,
        },
      }),
    onSuccess: () => {
      setMsg(t("assignments.recurring.created"));
      setErr(null);
      toast.success(t("assignments.recurring.toast.created"));
      setForm({
        title: "",
        description: "",
        due_date: defaultDueDate(),
        frequency: "weekly",
        interval: "1",
      });
      qc.invalidateQueries({ queryKey: ["assignments", "templates"] });
    },
    onError: (error) => {
      const message = t("assignments.recurring.createFailed");
      setErr(message);
      toast.error(t("assignments.recurring.toast.notCreated"), apiErrorMessage(error, message));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.due_date) {
      setErr(t("assignments.recurring.required"));
      return;
    }
    create.mutate();
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <ModulePageHeader
          title={t("assignments.recurring.title")}
          subtitle={t("assignments.recurring.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assignments.recurring.title") }]} />}
        />
        <Link href="/assignments/create" className="btn-primary">
          {t("assignments.newAssignment")}
        </Link>
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}

      <form onSubmit={onSubmit} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">{t("assignments.recurring.createTemplate")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label htmlFor="assignments-recurring-title-setform-f-required" className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-neutral-600">{t("assignments.create.titleLabel")}</span>
            <input id="assignments-recurring-title-setform-f-required"
              className="form-input w-full"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label htmlFor="assignments-recurring-description-setform-f-required" className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-neutral-600">{t("assignments.create.description")}</span>
            <textarea id="assignments-recurring-description-setform-f-required"
              className="form-input min-h-20 w-full"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </label>
          <label htmlFor="assignments-recurring-first-due-date-setform-f-required" className="block text-sm">
            <span className="mb-1 block text-neutral-600">{t("assignments.recurring.firstDueDate")}</span>
            <input id="assignments-recurring-first-due-date-setform-f-required"
              type="date"
              className="form-input w-full"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              required
            />
          </label>
          <label htmlFor="assignments-recurring-frequency-setform-f-weekly-biweekly-monthly" className="block text-sm">
            <span className="mb-1 block text-neutral-600">{t("assignments.recurring.frequency")}</span>
            <select id="assignments-recurring-frequency-setform-f-weekly-biweekly-monthly"
              className="form-input w-full"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            >
              <option value="weekly">{t("assignments.frequency.weekly")}</option>
              <option value="biweekly">{t("assignments.recurring.biweekly")}</option>
              <option value="monthly">{t("assignments.frequency.monthly")}</option>
            </select>
          </label>
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
          {create.isPending ? t("assignments.recurring.saving") : t("assignments.recurring.saveTemplate")}
        </button>
      </form>

      {isLoading && <p className="text-sm text-neutral-500">{t("common.loading")}</p>}

      {(data ?? []).length === 0 && !isLoading && (
        <div className="card">
          <EmptyState
            icon="repeat"
            title={t("assignments.recurring.emptyTitle")}
            description={t("assignments.recurring.emptyDescription")}
          />
        </div>
      )}

      <div className="space-y-3">
        {(data ?? []).map((tpl) => (
          <div key={tpl.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{tpl.title}</p>
              <p className="text-xs text-neutral-500 font-mono">{tpl.reference_number}</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => generate.mutate(tpl.id)}
              disabled={generate.isPending}
            >
              {t("assignments.recurring.generate")}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
