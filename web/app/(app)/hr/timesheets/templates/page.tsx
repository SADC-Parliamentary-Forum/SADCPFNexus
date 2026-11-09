"use client";

import { useCallback, useEffect, useState } from "react";
import {
  hrApi,
  type TimesheetProject,
  type TimesheetTemplate,
} from "@/lib/api";
import { getStoredUser } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
      hrApi.listTimesheetProjects().catch(() => ({ data: { data: [] } })),
    ])
      .then(([tmplRes, projRes]) => {
        setList(tmplRes.data?.data ?? []);
        setProjects(projRes.data?.data ?? []);
      })
      .catch(() => setError(t("hr.timesheets.templates.loadFailed")))
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

  const openEdit = (tpl: TimesheetTemplate) => {
    setEditId(tpl.id);
    setForm(fromTemplate(tpl));
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      showErrorToast(t("hr.timesheets.templates.nameCodeRequired"));
      return;
    }
    setSaving(true);
    try {
      const payload = toPayload(form);
      if (editId == null) {
        await hrApi.createTimesheetTemplate(payload);
        success(t("hr.timesheets.templates.created"));
      } else {
        await hrApi.updateTimesheetTemplate(editId, payload);
        success(t("hr.timesheets.templates.updated"));
      }
      setShowForm(false);
      setEditId(null);
      fetchList();
    } catch {
      showErrorToast(t("hr.timesheets.templates.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async (tpl: TimesheetTemplate) => {
    if (!tpl.is_active) return;
    const ok = await confirm({
      title: t("hr.timesheets.templates.deactivateTitle"),
      message: t("hr.timesheets.templates.deactivateMessage", { name: tpl.name }),
      confirmText: t("hr.timesheets.templates.deactivate"),
      variant: "danger",
    });
    if (!ok) return;
    try {
      await hrApi.deactivateTimesheetTemplate(tpl.id);
      success(t("hr.timesheets.templates.deactivated"));
      fetchList();
    } catch {
      showErrorToast(t("hr.timesheets.templates.deactivateFailed"));
    }
  };

  const handleReactivate = async (tpl: TimesheetTemplate) => {
    try {
      await hrApi.updateTimesheetTemplate(tpl.id, { is_active: true });
      success(t("hr.timesheets.templates.reactivated"));
      fetchList();
    } catch {
      showErrorToast(t("hr.timesheets.templates.reactivateFailed"));
    }
  };

  const projectLabel = (id?: number | null) =>
    projects.find((p) => p.id === id)?.label ?? (id ? `#${id}` : "—");

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.timesheets.templates.title"
        titleTestId="timesheet-templates-title"
        subtitle="hr.timesheets.templates.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "nav.hr", href: "/hr" },
              { label: "nav.timesheets", href: "/hr/timesheets" },
              { label: "hr.timesheets.templates.crumb" },
            ]}
          />
        }
        actions={
          allowed ? (
            <button
              type="button"
              onClick={openCreate}
              className="btn-primary flex items-center gap-2"
              data-testid="timesheet-templates-new"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              {t("hr.timesheets.templates.new")}
            </button>
          ) : undefined
        }
      />

      {!allowed && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {t("hr.timesheets.templates.readOnlyNotice")}
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
            {editId == null ? t("hr.timesheets.templates.createTitle") : t("hr.timesheets.templates.editTitle")}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="hr-timesheets-templates-name" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.name")}</label>
              <input id="hr-timesheets-templates-name"
                className="form-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={t("hr.timesheets.templates.namePlaceholder")}
                data-testid="timesheet-template-name"
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-code" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.code")}</label>
              <input id="hr-timesheets-templates-code"
                className="form-input font-mono"
                value={form.code}
                onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="SIDA-WK"
                data-testid="timesheet-template-code"
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-donor" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.donor")}</label>
              <input id="hr-timesheets-templates-donor"
                className="form-input"
                value={form.donor_name}
                onChange={(e) => setForm((f) => ({ ...f, donor_name: e.target.value }))}
                placeholder={t("hr.timesheets.templates.donorPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-sort-order" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.sortOrder")}</label>
              <input id="hr-timesheets-templates-sort-order"
                type="number"
                min={0}
                className="form-input"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) || 0 }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="hr-timesheets-templates-description" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.description")}</label>
              <input id="hr-timesheets-templates-description"
                className="form-input"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-default-project" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.defaultProject")}</label>
              <select id="hr-timesheets-templates-default-project"
                className="form-input"
                value={form.project_id}
                onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
              >
                <option value="">{t("hr.timesheets.templates.none")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-work-bucket" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.workBucket")}</label>
              <select id="hr-timesheets-templates-work-bucket"
                className="form-input"
                value={form.work_bucket}
                onChange={(e) => setForm((f) => ({ ...f, work_bucket: e.target.value }))}
              >
                {WORK_BUCKETS.map((b) => (
                  <option key={b} value={b}>
                    {t(`hr.timesheets.bucket.${b}`)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-activity-type" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.activityType")}</label>
              <input id="hr-timesheets-templates-activity-type"
                className="form-input"
                value={form.activity_type}
                onChange={(e) => setForm((f) => ({ ...f, activity_type: e.target.value }))}
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-entry-category" className="mb-1 block text-xs font-medium text-neutral-600">{t("hr.timesheets.templates.entryCategory")}</label>
              <input id="hr-timesheets-templates-entry-category"
                className="form-input"
                value={form.entry_category}
                onChange={(e) => setForm((f) => ({ ...f, entry_category: e.target.value }))}
                placeholder={t("hr.timesheets.templates.entryCategoryPlaceholder")}
              />
            </div>
            <div>
              <label htmlFor="hr-timesheets-templates-default-hours-day-no-ot-rates" className="mb-1 block text-xs font-medium text-neutral-600">
                {t("hr.timesheets.templates.defaultHours")}
              </label>
              <input id="hr-timesheets-templates-default-hours-day-no-ot-rates"
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
              <label htmlFor="hr-timesheets-templates-setform-f-active" className="flex items-center gap-2 text-sm text-neutral-700">
                <input id="hr-timesheets-templates-setform-f-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                {t("hr.timesheets.templates.active")}
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
              {saving ? t("hr.timesheets.saving") : editId == null ? t("common.create") : t("hr.timesheets.templates.saveChanges")}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setShowForm(false);
                setEditId(null);
              }}
            >
              {t("common.cancel")}
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden" data-testid="timesheet-templates-list">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            {t("common.loading")}
          </div>
        ) : list.length === 0 ? (
          <div data-testid="timesheet-templates-empty">
            <EmptyState
              icon="description"
              title={t("hr.timesheets.templates.empty")}
              description={t("hr.timesheets.templates.emptyHint")}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>{t("hr.timesheets.templates.name")}</th>
                  <th>{t("hr.timesheets.templates.code")}</th>
                  <th>{t("hr.timesheets.templates.donor")}</th>
                  <th>{t("hr.timesheets.col.project")}</th>
                  <th>{t("hr.timesheets.col.bucket")}</th>
                  <th>{t("hr.timesheets.col.hours")}</th>
                  <th>{t("hr.timesheets.monthly.status")}</th>
                  {allowed && <th className="text-right">{t("hr.timesheets.overtime.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((tpl) => (
                  <tr key={tpl.id} className={!tpl.is_active ? "opacity-60" : undefined}>
                    <td className="font-medium text-neutral-900">{tpl.name}</td>
                    <td className="font-mono text-xs text-neutral-600">{tpl.code}</td>
                    <td className="text-sm text-neutral-700">{tpl.donor_name || "—"}</td>
                    <td className="max-w-[180px] truncate text-sm text-neutral-600">
                      {projectLabel(tpl.defaults?.project_id)}
                    </td>
                    <td className="text-xs capitalize text-neutral-600">
                      {tpl.defaults?.work_bucket ? t(`hr.timesheets.bucket.${tpl.defaults.work_bucket}`) : "—"}
                    </td>
                    <td className="text-sm tabular-nums">{tpl.defaults?.hours ?? "—"}</td>
                    <td>
                      <span className={`badge text-xs ${tpl.is_active ? "badge-success" : "badge-muted"}`}>
                        {tpl.is_active ? t("hr.timesheets.templates.active") : t("hr.timesheets.templates.inactive")}
                      </span>
                    </td>
                    {allowed && (
                      <td className="whitespace-nowrap text-right">
                        <button
                          type="button"
                          className="mr-2 btn-secondary text-xs"
                          data-testid="timesheet-template-edit"
                          onClick={() => openEdit(tpl)}
                        >
                          {t("common.edit")}
                        </button>
                        {tpl.is_active ? (
                          <button
                            type="button"
                            className="btn-secondary text-xs text-red-600"
                            onClick={() => void handleDeactivate(tpl)}
                          >
                            {t("hr.timesheets.templates.deactivate")}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-secondary text-xs text-green-700"
                            onClick={() => void handleReactivate(tpl)}
                          >
                            {t("hr.timesheets.templates.reactivate")}
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
