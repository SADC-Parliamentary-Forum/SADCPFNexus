"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  adminApi,
  hrApi,
  type TimesheetProject,
  type TimesheetTemplate,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const WORK_BUCKETS = [
  "delivery",
  "meeting",
  "communication",
  "administration",
  "other",
] as const;

type FormState = {
  name: string;
  code: string;
  donor_name: string;
  description: string;
  sort_order: number;
  is_active: boolean;
  project_id: string;
  work_bucket: string;
  activity_type: string;
  entry_category: string;
  hours: string;
};

const emptyForm = (): FormState => ({
  name: "",
  code: "",
  donor_name: "",
  description: "",
  sort_order: 0,
  is_active: true,
  project_id: "",
  work_bucket: "delivery",
  activity_type: "",
  entry_category: "donor",
  hours: "8",
});

function canManageTemplates(): boolean {
  const u = getStoredUser();
  if (!u) return false;
  const perms = u.permissions ?? [];
  return (
    perms.includes("hr.admin") ||
    perms.includes("timesheets.admin") ||
    perms.includes("system.admin") ||
    (u.roles ?? []).some((r) => ["HR Administrator", "System Administrator"].includes(r))
  );
}

function toPayload(form: FormState) {
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    donor_name: form.donor_name.trim() || null,
    description: form.description.trim() || null,
    sort_order: form.sort_order,
    is_active: form.is_active,
    defaults: {
      project_id: form.project_id ? Number(form.project_id) : null,
      work_bucket: form.work_bucket || null,
      activity_type: form.activity_type.trim() || null,
      entry_category: form.entry_category.trim() || null,
      hours: form.hours === "" ? null : Number(form.hours),
    },
  };
}

function fromTemplate(t: TimesheetTemplate): FormState {
  return {
    name: t.name,
    code: t.code,
    donor_name: t.donor_name ?? "",
    description: t.description ?? "",
    sort_order: t.sort_order ?? 0,
    is_active: t.is_active,
    project_id: t.defaults?.project_id != null ? String(t.defaults.project_id) : "",
    work_bucket: t.defaults?.work_bucket ?? "delivery",
    activity_type: t.defaults?.activity_type ?? "",
    entry_category: t.defaults?.entry_category ?? "",
    hours: t.defaults?.hours != null ? String(t.defaults.hours) : "8",
  };
}

export default function TimesheetTemplatesAdminPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { confirm } = useConfirm();
  const [list, setList] = useState<TimesheetTemplate[]>([]);
  const [projects, setProjects] = useState<TimesheetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setAllowed(canManageTemplates());
  }, []);

  const showToast = (msg: string, isError = false) => {
    success(msg);
    setToastError(isError);
    setTimeout(() => {
      
      setToastError(false);
    }, 4000);
  };

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      hrApi.listTimesheetTemplates({ include_inactive: 1 }),
      adminApi.listTimesheetProjects(),
    ])
      .then(([tmplRes, projRes]) => {
        setList(tmplRes.data?.data ?? []);
        setProjects(projRes.data?.data ?? []);
      })
      .catch(() => setError("Failed to load timesheet templates."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const openCreate = () => {
    setEditId(null);
    setForm(emptyForm());
    setShowForm(true);
  };

  const openEdit = (t: TimesheetTemplate) => {
    setEditId(t.id);
    setForm(fromTemplate(t));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      showErrorToast("Name and code are required.");
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editId == null) {
        await hrApi.createTimesheetTemplate(payload);
        success("Template created.");
      } else {
        await hrApi.updateTimesheetTemplate(editId, payload);
        success("Template updated.");
      }
      setShowForm(false);
      setEditId(null);
      fetchList();
    } catch {
      showErrorToast("Failed to save template.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (t: TimesheetTemplate) => {
    if (!t.is_active) return;
    const ok = await confirm({
      title: "Deactivate template?",
      message: `“${t.name}” will no longer be available for staff timesheets.`,
      confirmText: "Deactivate",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await hrApi.deactivateTimesheetTemplate(t.id);
      success("Template deactivated.");
      fetchList();
    } catch {
      showErrorToast("Failed to deactivate template.");
    }
  };

  const handleReactivate = async (t: TimesheetTemplate) => {
    try {
      await hrApi.updateTimesheetTemplate(t.id, { is_active: true });
      success("Template reactivated.");
      fetchList();
    } catch {
      showErrorToast("Failed to reactivate template.");
    }
  };

  const projectLabel = (id?: number | null) =>
    projects.find((p) => p.id === id)?.label ?? (id ? `#${id}` : "—");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
<div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/hr/timesheets" className="transition-colors hover:text-primary">
          Timesheets
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="font-medium text-neutral-900">Templates</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title" data-testid="timesheet-templates-title">
            Timesheet templates
          </h1>
          <p className="page-subtitle">
            Donor / project defaults for draft weeks. Does not invent overtime rates — only ordinary hours.
          </p>
        </div>
        {allowed && (
          <button
            type="button"
            onClick={openCreate}
            className="btn-primary flex items-center gap-2"
            data-testid="timesheet-templates-new"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New template
          </button>
        )}
      </div>

      {!allowed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          You can view templates, but only HR administrators can create or edit them.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {showForm && allowed && (
        <div className="card space-y-4 p-5" data-testid="timesheet-templates-form">
          <h2 className="text-sm font-semibold text-neutral-900">
            {editId == null ? "Create template" : "Edit template"}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Name</label>
              <input
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Sida weekly"
                data-testid="timesheet-template-name"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Code</label>
              <input
                className="form-input font-mono"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SIDA-WK"
                data-testid="timesheet-template-code"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Donor</label>
              <input
                className="form-input"
                value={form.donor_name}
                onChange={(e) => setForm((f) => ({ ...f, donor_name: e.target.value }))}
                placeholder="Sida / EU / …"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Sort order</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-neutral-600">Description</label>
              <input
                className="form-input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Default project</label>
              <select
                className="form-input"
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              >
                <option value="">None</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Work bucket</label>
              <select
                className="form-input"
                value={form.work_bucket}
                onChange={(e) => setForm((f) => ({ ...f, work_bucket: e.target.value }))}
              >
                {WORK_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Activity type</label>
              <input
                className="form-input"
                value={form.activity_type}
                onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">Entry category</label>
              <input
                className="form-input"
                value={form.entry_category}
                onChange={(e) => setForm((f) => ({ ...f, entry_category: e.target.value }))}
                placeholder="donor / core / …"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Default hours / day (no OT rates)
              </label>
              <input
                type="number"
                min={0}
                max={24}
                step={0.5}
                className="form-input"
                value={form.hours}
                onChange={(e) => setForm((f) => ({ ...f, hours: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                Active
              </label>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary disabled:opacity-50"
              disabled={saving}
              onClick={() => void handleSave()}
              data-testid="timesheet-template-save"
            >
              {saving ? "Saving…" : editId == null ? "Create" : "Save changes"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden" data-testid="timesheet-templates-list">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="px-5 py-16 text-center" data-testid="timesheet-templates-empty">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">
              description
            </span>
            <p className="text-sm font-semibold text-neutral-600">No templates yet</p>
            <p className="mt-1 text-xs text-neutral-400">
              Create a donor or project template so staff can prefill draft weeks.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Donor</th>
                  <th>Project</th>
                  <th>Bucket</th>
                  <th>Hours</th>
                  <th>Status</th>
                  {allowed && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((t) => (
                  <tr key={t.id} className={!t.is_active ? "opacity-60" : undefined}>
                    <td className="font-medium text-neutral-900">{t.name}</td>
                    <td className="font-mono text-xs text-neutral-600">{t.code}</td>
                    <td className="text-sm text-neutral-700">{t.donor_name || "—"}</td>
                    <td className="max-w-[180px] truncate text-sm text-neutral-600">
                      {projectLabel(t.defaults?.project_id)}
                    </td>
                    <td className="text-xs capitalize text-neutral-600">
                      {t.defaults?.work_bucket || "—"}
                    </td>
                    <td className="text-sm tabular-nums">{t.defaults?.hours ?? "—"}</td>
                    <td>
                      <span className={`badge text-xs ${t.is_active ? "badge-success" : "badge-muted"}`}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    {allowed && (
                      <td className="whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="mr-2 text-xs font-medium text-primary hover:underline"
                          data-testid="timesheet-template-edit"
                          onClick={() => openEdit(t)}
                        >
                          Edit
                        </button>
                        {t.is_active ? (
                          <button
                            type="button"
                            className="text-xs font-medium text-red-600 hover:underline"
                            onClick={() => void handleDeactivate(t)}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="text-xs font-medium text-green-700 hover:underline"
                            onClick={() => void handleReactivate(t)}
                          >
                            Reactivate
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
