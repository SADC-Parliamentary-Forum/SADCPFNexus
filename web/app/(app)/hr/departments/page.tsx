"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState, useEffect } from "react";
import { adminApi, type Department, type User } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AdminDepartmentsPage() {
  const { t } = useI18n();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [form, setForm] = useState<{ name: string; code: string; parent_id: number | null; supervisor_id: number | null }>({ name: "", code: "", parent_id: null, supervisor_id: null });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const { confirm } = useConfirm();

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
  }, []);

  useEffect(() => {
    Promise.all([
      adminApi.listDepartments(),
      adminApi.listUsers({ per_page: 100 })
    ])
      .then(([deptRes, userRes]) => {
        setDepartments((deptRes.data as any).data ?? []);
        setUsers((userRes.data as any).data ?? []);
      })
      .catch(() => setError(t("hr.departments.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim() || !form.code.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editId) {
        await adminApi.updateDepartment(editId, {
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          parent_id: form.parent_id,
          supervisor_id: form.supervisor_id
        });
        const res = await adminApi.listDepartments();
        setDepartments((res.data as any).data ?? []);
        setEditId(null);
      } else {
        await adminApi.createDepartment({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          parent_id: form.parent_id,
          supervisor_id: form.supervisor_id
        });
        const res = await adminApi.listDepartments();
        setDepartments((res.data as any).data ?? []);
      }
      setForm({ name: "", code: "", parent_id: null, supervisor_id: null });
      setShowForm(false);
    } catch {
      setError(t("hr.departments.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (dept: Department) => {
    setEditId(dept.id);
    setForm({
      name: dept.name,
      code: dept.code,
      parent_id: dept.parent_id || null,
      supervisor_id: dept.supervisor_id || null
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditId(null);
    setForm({ name: "", code: "", parent_id: null, supervisor_id: null });
  };

  const handleDelete = async (id: number, name: string) => {
    if (!(await confirm({ title: t("hr.departments.deleteTitle"), message: t("hr.departments.deleteMessage", { name }), variant: "danger" }))) return;
    try {
      await adminApi.deleteDepartment(id);
      setDepartments((prev) => prev.filter(d => d.id !== id));
      toast("success", t("hr.departments.deleted"));
    } catch (err: any) {
      toast("error", t("hr.departments.deleteFailed"), err.response?.data?.message || t("hr.departments.deleteFailedHint"));
    }
  };

  // Department color based on code letter
  const deptColors = [
    "bg-primary/10 text-primary",
    "bg-purple-100 text-purple-700",
    "bg-green-100 text-green-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-teal-100 text-teal-700",
  ];
  const getDeptColor = (code: string) => deptColors[code.charCodeAt(0) % deptColors.length];

  return (
    <div className="w-full min-w-0 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title="hr.departments.title"
        subtitle="hr.departments.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "hr.departments.title" }]} />}
      />
        {isAdmin && (
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", code: "", parent_id: null, supervisor_id: null }); }}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[18px]">{showForm && !editId ? "close" : "add"}</span>
            {showForm && !editId ? t("common.cancel") : t("hr.departments.new")}
          </button>
        )}
      </div>

      {/* Form card */}
      {isAdmin && showForm && (
        <div className="card border-primary/20 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <span className="material-symbols-outlined text-primary text-[18px]">{editId ? "edit" : "add_business"}</span>
            </div>
            <h3 className="text-sm font-semibold text-neutral-900">{editId ? t("hr.departments.edit") : t("hr.departments.new")}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="hr-departments-name" className="block text-xs font-semibold text-neutral-700">
                {t("hr.departments.name")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">corporate_fare</span>
                <input
                  id="hr-departments-name"
                  className="form-input pl-8"
                  placeholder={t("hr.departments.namePlaceholder")}
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hr-departments-code" className="block text-xs font-semibold text-neutral-700">
                {t("hr.departments.code")} <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">tag</span>
                <input
                  id="hr-departments-code"
                  className="form-input pl-8 uppercase font-mono"
                  placeholder={t("hr.departments.codePlaceholder")}
                  maxLength={6}
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hr-departments-parent" className="block text-xs font-semibold text-neutral-700">
                {t("hr.departments.parent")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">hub</span>
                <select
                  id="hr-departments-parent"
                  className="form-input pl-8"
                  value={form.parent_id || ""}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">{t("hr.departments.topLevel")}</option>
                  {departments
                    .filter(d => d.id !== editId)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  }
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="hr-departments-supervisor" className="block text-xs font-semibold text-neutral-700">
                {t("hr.departments.supervisor")}
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">person</span>
                <select
                  id="hr-departments-supervisor"
                  className="form-input pl-8"
                  value={form.supervisor_id || ""}
                  onChange={(e) => setForm((p) => ({ ...p, supervisor_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">{t("hr.departments.selectSupervisor")}</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelForm} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">close</span>
              {t("common.cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name || !form.code || saving}
              className="btn-primary"
            >
              {saving ? (
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[16px]">{editId ? "save" : "add"}</span>
              )}
              {saving ? t("hr.timesheets.saving") : editId ? t("hr.departments.update") : t("hr.departments.create")}
            </button>
          </div>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 flex items-center gap-2">
          <span className="material-symbols-outlined text-red-500 text-[18px]">error_outline</span>
          <span className="text-sm text-red-700">{error}</span>
        </div>
      )}

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: t("hr.departments.totalDepartments"), value: departments.length, icon: "corporate_fare", color: "text-primary", bg: "bg-primary/10" },
            { label: t("hr.departments.totalStaff"), value: departments.reduce((s, d) => s + (d.users_count ?? 0), 0), icon: "people", color: "text-green-600", bg: "bg-green-50" },
            { label: t("hr.departments.activeUnits"), value: departments.filter(d => (d.users_count ?? 0) > 0).length, icon: "hub", color: "text-primary", bg: "bg-primary/10" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg} flex-shrink-0`}>
                  <span className={`material-symbols-outlined text-[20px] ${s.color}`}>{s.icon}</span>
                </div>
                <div>
                  <p className="text-xl font-bold text-neutral-900">{s.value}</p>
                  <p className="text-xs text-neutral-400">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Departments table */}
      <div className="card overflow-hidden">
        <div className="card-header">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-neutral-400 text-[18px]">corporate_fare</span>
            <h3 className="text-sm font-semibold text-neutral-900">{t("hr.departments.all")}</h3>
          </div>
          <span className="badge-muted">{t("common.totalCount", { count: departments.length })}</span>
        </div>

        {loading ? (
          <div className="divide-y divide-neutral-50">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 animate-pulse">
                <div className="h-9 w-9 rounded-lg bg-neutral-100 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 bg-neutral-100 rounded" />
                  <div className="h-3 w-24 bg-neutral-100 rounded" />
                </div>
                <div className="h-6 w-12 bg-neutral-100 rounded" />
                <div className="h-6 w-16 bg-neutral-100 rounded" />
              </div>
            ))}
          </div>
        ) : departments.length === 0 ? (
          <EmptyState
            icon="corporate_fare"
            title={t("hr.departments.empty")}
            description={isAdmin ? t("hr.departments.emptyAdmin") : t("hr.departments.emptyViewer")}
            action={isAdmin ? (
              <button type="button" onClick={() => setShowForm(true)} className="btn-primary">
                <span className="material-symbols-outlined text-[16px]">add</span>
                {t("hr.departments.new")}
              </button>
            ) : undefined}
          />
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>{t("hr.departments.department")}</th>
                <th>{t("hr.timesheets.templates.code")}</th>
                <th>{t("hr.departments.head")}</th>
                <th>{t("hr.departments.staff")}</th>
                {isAdmin && <th className="text-right">{t("hr.timesheets.overtime.actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {departments.map((dept) => {
                const colorCls = getDeptColor(dept.code);
                return (
                  <tr key={dept.id} className={editId === dept.id ? "bg-primary/5" : ""}>
                    <td>
                      <div className="flex items-center gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colorCls}`}>
                          <span className="text-[11px] font-bold">{dept.code.slice(0, 3)}</span>
                        </div>
                        <span className="font-semibold text-neutral-900">{dept.name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2.5 py-1 text-xs font-mono font-semibold text-neutral-700">
                        <span className="material-symbols-outlined text-[11px] text-neutral-400">tag</span>
                        {dept.code}
                      </span>
                    </td>
                    <td>
                      {dept.supervisor ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-bold">
                            {dept.supervisor.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <span className="text-sm font-medium text-neutral-700">{dept.supervisor.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-neutral-400 italic">{t("hr.departments.notAssigned")}</span>
                      )}
                    </td>
                    <td>
                      <span className="flex items-center gap-1.5 text-neutral-600">
                        <span className="material-symbols-outlined text-[14px] text-neutral-300">people</span>
                        <span className="font-medium">{dept.users_count ?? 0}</span>
                        <span className="text-neutral-400 text-xs">{t("hr.departments.staffSuffix")}</span>
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => startEdit(dept)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-primary hover:bg-primary/5 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">edit</span>
                            {t("common.edit")}
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id, dept.name)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            {t("common.delete")}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
