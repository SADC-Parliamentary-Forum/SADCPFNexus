"use client";

import { useState, useEffect } from "react";
import { adminApi, type Department, type User } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";

export default function AdminDepartmentsPage() {
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
      .catch(() => setError("Failed to load departments or users."))
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
      setError("Failed to save department.");
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
    if (!(await confirm({ title: "Delete Department", message: `Are you sure you want to delete the department "${name}"? It cannot be undone.`, variant: "danger" }))) return;
    try {
      await adminApi.deleteDepartment(id);
      setDepartments((prev) => prev.filter(d => d.id !== id));
      toast("success", "Department deleted");
    } catch (err: any) {
      toast("error", "Failed to delete department", err.response?.data?.message || "It might have sub-units or assigned staff.");
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
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Departments</h1>
          <p className="page-subtitle">Manage organisational units and their department codes.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => { setShowForm(!showForm); setEditId(null); setForm({ name: "", code: "", parent_id: null, supervisor_id: null }); }}
            className="btn-primary"
          >
            <span className="material-symbols-outlined text-[18px]">{showForm && !editId ? "close" : "add"}</span>
            {showForm && !editId ? "Cancel" : "New Department"}
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
            <h3 className="text-sm font-semibold text-neutral-900">{editId ? "Edit Department" : "New Department"}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Department Name <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">corporate_fare</span>
                <input
                  className="form-input pl-8"
                  placeholder="e.g. Finance & Administration"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Department Code <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">tag</span>
                <input
                  className="form-input pl-8 uppercase font-mono"
                  placeholder="e.g. FIN"
                  maxLength={6}
                  value={form.code}
                  onChange={(e) => setForm((p) => ({ ...p, code: e.target.value.toUpperCase() }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Parent Department
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">hub</span>
                <select
                  className="form-input pl-8"
                  value={form.parent_id || ""}
                  onChange={(e) => setForm((p) => ({ ...p, parent_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">None (Top Level)</option>
                  {departments
                    .filter(d => d.id !== editId)
                    .map(d => <option key={d.id} value={d.id}>{d.name}</option>)
                  }
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-neutral-700">
                Department Supervisor
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-300 text-[16px]">person</span>
                <select
                  className="form-input pl-8"
                  value={form.supervisor_id || ""}
                  onChange={(e) => setForm((p) => ({ ...p, supervisor_id: e.target.value ? Number(e.target.value) : null }))}
                >
                  <option value="">Select Supervisor</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelForm} className="btn-secondary">
              <span className="material-symbols-outlined text-[16px]">close</span>
              Cancel
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
              {saving ? "Saving…" : editId ? "Update Department" : "Create Department"}
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
            { label: "Total Departments", value: departments.length, icon: "corporate_fare", color: "text-primary", bg: "bg-primary/10" },
            { label: "Total Staff", value: departments.reduce((s, d) => s + (d.users_count ?? 0), 0), icon: "people", color: "text-green-600", bg: "bg-green-50" },
            { label: "Active Units", value: departments.filter(d => (d.users_count ?? 0) > 0).length, icon: "hub", color: "text-purple-600", bg: "bg-purple-50" },
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
            <h3 className="text-sm font-semibold text-neutral-900">All Departments</h3>
          </div>
          <span className="badge-muted">{departments.length} total</span>
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
          <div className="px-5 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 mx-auto mb-4">
              <span className="material-symbols-outlined text-3xl text-neutral-300">corporate_fare</span>
            </div>
            <p className="text-sm font-semibold text-neutral-500">No departments yet</p>
            <p className="text-xs text-neutral-400 mt-1">{isAdmin ? "Create your first department to get started." : "You can view departments only."}</p>
            {isAdmin && (
              <button onClick={() => setShowForm(true)} className="btn-primary mt-4">
                <span className="material-symbols-outlined text-[16px]">add</span>
                New Department
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Code</th>
                <th>Head / Supervisor</th>
                <th>Staff</th>
                {isAdmin && <th className="text-right">Actions</th>}
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
                        <span className="text-xs text-neutral-400 italic">Not assigned</span>
                      )}
                    </td>
                    <td>
                      <span className="flex items-center gap-1.5 text-neutral-600">
                        <span className="material-symbols-outlined text-[14px] text-neutral-300">people</span>
                        <span className="font-medium">{dept.users_count ?? 0}</span>
                        <span className="text-neutral-400 text-xs">staff</span>
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
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(dept.id, dept.name)}
                            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <span className="material-symbols-outlined text-[14px]">delete</span>
                            Delete
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
