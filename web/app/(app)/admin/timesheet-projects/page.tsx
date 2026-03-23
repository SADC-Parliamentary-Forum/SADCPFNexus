"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { adminApi, type TimesheetProject } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";

export default function AdminTimesheetProjectsPage() {
  const [list, setList] = useState<TimesheetProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastError, setToastError] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newSortOrder, setNewSortOrder] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editSortOrder, setEditSortOrder] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: number; label: string } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
  }, []);

  const showToast = (msg: string, isError = false) => {
    setToast(msg);
    setToastError(isError);
    setTimeout(() => {
      setToast(null);
      setToastError(false);
    }, 4000);
  };

  const fetchList = useCallback(() => {
    setLoading(true);
    setError(null);
    adminApi
      .listTimesheetProjects()
      .then((res) => setList(res.data?.data ?? []))
      .catch(() => setError("Failed to load projects."))
      .finally(() => setLoading(false));
  }, []);

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
      showToast("Project added.");
      fetchList();
    } catch {
      showToast("Failed to add project.", true);
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
      showToast("Project updated.");
      fetchList();
    } catch {
      showToast("Failed to update project.", true);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await adminApi.deleteTimesheetProject(deleteConfirm.id);
      setDeleteConfirm(null);
      showToast("Project deleted.");
      fetchList();
    } catch {
      showToast("Failed to delete project.", true);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${toastError ? "bg-red-600" : "bg-green-600"}`}
        >
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {toastError ? "error" : "check_circle"}
          </span>
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 text-sm text-neutral-500">
        <Link href="/admin" className="hover:text-primary transition-colors">
          Admin
        </Link>
        <span className="material-symbols-outlined text-[16px]">chevron_right</span>
        <span className="text-neutral-900 font-medium">Timesheet Projects</span>
      </div>

      <div>
        <h1 className="page-title">Timesheet Projects</h1>
        <p className="page-subtitle">Manage project options shown on the HR timesheets page. Staff select these when logging time.</p>
      </div>

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
            <label className="block text-xs font-medium text-neutral-600 mb-1">Label</label>
            <input
              type="text"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="e.g. SADCPF-2026-PLN: Annual Planning"
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <div className="w-24">
            <label className="block text-xs font-medium text-neutral-600 mb-1">Order</label>
            <input
              type="number"
              min={0}
              value={newSortOrder}
              onChange={(e) => setNewSortOrder(parseInt(e.target.value, 10) || 0)}
              className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
          <button type="button" onClick={handleAdd} disabled={saving || !newLabel.trim()} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
            {saving ? "Adding…" : "Add"}
          </button>
          <button type="button" onClick={() => { setShowAdd(false); setNewLabel(""); setNewSortOrder(0); }} className="px-4 py-2 text-sm text-neutral-600 hover:text-neutral-900">
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setShowAdd(true)} className="btn-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add project
        </button>
      ))}

      {/* List */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-neutral-500 flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            Loading…
          </div>
        ) : list.length === 0 ? (
          <div className="p-8 text-center text-sm text-neutral-500">No projects yet. Add one above or they will fall back to config defaults on the timesheets page.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Label</th>
                  <th className="w-20 text-right">Order</th>
                  {isAdmin && <th className="w-32 text-right">Actions</th>}
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
                        <button type="button" onClick={handleUpdate} disabled={saving} className="text-primary hover:underline text-sm font-medium mr-2">
                          Save
                        </button>
                        <button type="button" onClick={() => setEditId(null)} className="text-neutral-500 hover:underline text-sm">
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={p.id}>
                      <td className="font-medium text-neutral-900">{p.label}</td>
                      <td className="text-right text-neutral-600">{p.sort_order}</td>
                      {isAdmin && (
                        <td className="text-right">
                          <button type="button" onClick={() => startEdit(p)} className="text-primary hover:underline text-sm font-medium mr-2">
                            Edit
                          </button>
                          <button type="button" onClick={() => setDeleteConfirm({ id: p.id, label: p.label })} className="text-red-600 hover:underline text-sm font-medium">
                            Delete
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

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="card max-w-sm w-full p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900 mb-2">Delete project?</h3>
            <p className="text-sm text-neutral-600 mb-4">“{deleteConfirm.label}” will be removed. Staff will no longer see it in the timesheet project list.</p>
            <div className="flex gap-3 justify-end">
              <button type="button" onClick={() => setDeleteConfirm(null)} className="px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg">
                Cancel
              </button>
              <button type="button" onClick={() => handleDelete()} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg">
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
