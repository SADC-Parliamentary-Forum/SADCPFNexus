"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { assignmentsApi, type Assignment } from "@/lib/api";

function defaultDueDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export default function RecurringAssignmentsPage() {
  const qc = useQueryClient();
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
      setMsg("Instance generated as a separate assignment.");
      setErr(null);
      qc.invalidateQueries({ queryKey: ["assignments"] });
    },
    onError: () => setErr("Could not generate an instance from this template."),
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
      setMsg("Recurring template created.");
      setErr(null);
      setForm({
        title: "",
        description: "",
        due_date: defaultDueDate(),
        frequency: "weekly",
        interval: "1",
      });
      qc.invalidateQueries({ queryKey: ["assignments", "templates"] });
    },
    onError: () => setErr("Could not create the template. Title, description, and a future due date are required."),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.due_date) {
      setErr("Title, description, and due date are required.");
      return;
    }
    create.mutate();
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <ModulePageHeader
          title="Recurring Tasks"
          subtitle="Templates generate separate assignment instances — never overwrite history."
          breadcrumbs={<PageBreadcrumbs items={[{ label: "Recurring Tasks" }]} />}
        />
        <Link href="/assignments/create" className="btn-primary">
          New Assignment
        </Link>
      </div>

      {msg && <p className="text-sm text-green-700">{msg}</p>}
      {err && <p className="text-sm text-red-700">{err}</p>}

      <form onSubmit={onSubmit} className="card space-y-3 p-4">
        <h2 className="text-sm font-semibold text-neutral-900">Create template</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-neutral-600">Title</span>
            <input
              className="form-input w-full"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-neutral-600">Description</span>
            <textarea
              className="form-input min-h-20 w-full"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">First due date</span>
            <input
              type="date"
              className="form-input w-full"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              required
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-neutral-600">Frequency</span>
            <select
              className="form-input w-full"
              value={form.frequency}
              onChange={(e) => setForm((f) => ({ ...f, frequency: e.target.value }))}
            >
              <option value="weekly">Weekly</option>
              <option value="biweekly">Biweekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        <button type="submit" className="btn-primary text-sm" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Save template"}
        </button>
      </form>

      {isLoading && <p className="text-sm text-neutral-500">Loading…</p>}

      {(data ?? []).length === 0 && !isLoading && (
        <div className="card p-8 text-sm text-neutral-500 text-center">
          No recurring templates yet. Use the form above to create one.
        </div>
      )}

      <div className="space-y-3">
        {(data ?? []).map((t) => (
          <div key={t.id} className="card p-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold">{t.title}</p>
              <p className="text-xs text-neutral-500 font-mono">{t.reference_number}</p>
            </div>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => generate.mutate(t.id)}
              disabled={generate.isPending}
            >
              Generate instance
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
