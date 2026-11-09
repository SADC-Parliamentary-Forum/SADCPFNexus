"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { adminApi, type TimesheetProject } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AdminTimesheetProjectsPage() {
  const { t } = useI18n();
  const { confirm } = useConfirm();
  const { success, error: showErrorToast, info } = useToast();
  const [list, setList] = useState<TimesheetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
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
    adminApi
      .listTimesheetProjects()
      .then((res) => setList(res.data?.data ?? []))
      .catch(() => setError(t("admin.timesheetProjects.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    setSaving(true);
    try {
      await adminApi.createTimesheetProject({ label, sort_order: newSortOrder });
      setNewLabel("");
      setNewSortOrder(0);
      setShowAdd(false);
      success(t("admin.timesheetProjects.added"));
      fetchList();
    } catch {
      showErrorToast(t("admin.timesheetProjects.addFailed"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (p: TimesheetProject) => {
    setEditId(p.id);
    setEditLabel(p.label);
    setEditSortOrder(p.sort_order);
  };

  const handleUpdate = async () => {
    if (editId === null) return;
    setSaving(true);
    try {
      await adminApi.updateTimesheetProject(editId, { label: editLabel.trim() || undefined, sort_order: editSortOrder });
      setEditId(null);
      success(t("admin.timesheetProjects.updated"));
      fetchList();
    } catch {
      showErrorToast(t("admin.timesheetProjects.updateFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (project: TimesheetProject) => {
    if (
      !(await confirm({
        title: t("admin.timesheetProjects.deleteTitle"),
        message: t("admin.timesheetProjects.deleteMessage", { label: project.label }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) return;
    try {
      await adminApi.deleteTimesheetProject(project.id);
      success(t("admin.timesheetProjects.deleted"));
      fetchList();
    } catch {
      showErrorToast(t("admin.timesheetProjects.deleteFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
<div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">
          {t("admin.homeLabel")}
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">{t("admin.home.timesheetProjects")}</span>
      </div>

      <ModulePageHeader
        title={t("admin.home.timesheetProjects")}
        subtitle={t("admin.timesheetProjects.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.home.timesheetProjects") }]} />}
      />

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Add form */}
      {isAdmin && (showAdd ? (
        <div className="card p-4 flex flex-wrap items-end gap-3">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="admin-timesheet-projects-label" className="block text-xs font-medium text-neutral-600 mb-1">{t("admin.timesheetProjects.label")}</label>
            <input id="admin-timesheet-projects-label"
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("admin.timesheetProjects.labelPlaceholder")}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="w-24">
            <label htmlFor="admin-timesheet-projects-order" className="block text-xs font-medium text-neutral-600 mb-1">{t("admin.timesheetProjects.order")}</label>
            <input id="admin-timesheet-projects-order"
              type="number"
              min={0}
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button type="button" onClick={handleAdd} disabled={saving || !newLabel.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? t("admin.timesheetProjects.adding") : t("common.add")}
          </button>
          <button type="button" onClick={() => { setShowAdd(false); setNewLabel(""); setNewSortOrder(0); }} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900">
            {t("common.cancel")}
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("admin.timesheetProjects.addProject")}
        </button>
      ))}

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            {t("common.loading")}
          </div>
        ) : list.length === 0 ? (
          <EmptyState
            icon="folder"
            title={t("admin.timesheetProjects.empty")}
            description={t("admin.timesheetProjects.emptyDesc")}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t("admin.timesheetProjects.label")}</th>
                  <th className="w-20 text-right">{t("admin.timesheetProjects.order")}</th>
                  {isAdmin && <th className="w-32 text-right">{t("admin.common.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {list.map((p) =>
                  editId === p.id && isAdmin ? (
                    <tr key={p.id}>
                      <td>
                        <input
                          type="text"
                          value={editLabel}
                          onChange={(e) => setEditLabel(e.target.value)}
                          className="w-full rounded-md border border-neutral-200 px-2 py-1.5 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                        />
                      </td>
                      <td className="text-right">
                        <input
                          type="number"
                          min={0}
                          value={editSortOrder}
                          onChange={(e) => setEditSortOrder(parseInt(e.target.value, 10) || 0)}
                          className="w-16 rounded-md border border-neutral-200 px-2 py-1.5 text-sm text-right focus:border-primary outline-none"
                        />
                      </td>
                      <td className="text-right">
                        <button type="button" onClick={handleUpdate} disabled={saving} className="btn-secondary text-sm py-1 px-2 mr-2">
                          {t("common.save")}
                        </button>
                        <button type="button" onClick={() => setEditId(null)} className="btn-secondary text-sm py-1 px-2">
                          {t("common.cancel")}
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="font-medium text-neutral-900">{p.label}</td>
                      <td className="text-right text-neutral-600">{p.sort_order}</td>
                      {isAdmin && (
                        <td className="text-right">
                          <button type="button" onClick={() => startEdit(p)} className="btn-secondary text-sm py-1 px-2 mr-2">
                            {t("common.edit")}
                          </button>
                          <button type="button" onClick={() => handleDelete(p)} className="btn-secondary text-sm py-1 px-2 text-red-600">
                            {t("common.delete")}
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
