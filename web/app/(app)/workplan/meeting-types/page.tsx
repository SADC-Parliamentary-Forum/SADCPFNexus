"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { workplanMeetingTypesApi, type MeetingType } from "@/lib/api";

export default function MeetingTypesPage() {
  const [list, setList] = useState<MeetingType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workplanMeetingTypesApi.list();
      setList(res.data?.data ?? []);
    } catch {
      setError("Failed to load meeting types.");
      setList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setDescription("");
    setSortOrder("");
  };

  const handleEdit = (mt: MeetingType) => {
    setEditingId(mt.id);
    setShowForm(true);
    setName(mt.name);
    setDescription(mt.description ?? "");
    setSortOrder(mt.sort_order != null ? String(mt.sort_order) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await workplanMeetingTypesApi.update(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      } else {
        await workplanMeetingTypesApi.create({
          name: name.trim(),
          description: description.trim() || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      }
      resetForm();
      loadList();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (mt: MeetingType) => {
    if (!confirm(`Delete meeting type "${mt.name}"? This will fail if any event uses it.`)) return; // ship-safe-ignore: confirm dialog string, not SQL
    setError(null);
    try {
      await workplanMeetingTypesApi.delete(mt.id);
      loadList();
    } catch (err: unknown) {
      setError(err && typeof err === "object" && "message" in err ? String((err as { message: string }).message) : "Cannot delete (may be in use).");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/workplan" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            Workplan
          </Link>
          <h1 className="page-title">Meeting types</h1>
          <p className="page-subtitle">
            Add and edit meeting types used when creating workplan events of type &quot;Meeting&quot;.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add meeting type
        </button>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-900">{editingId ? "Edit meeting type" : "New meeting type"}</h2>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Name *</label>
            <input
              type="text"
              className="form-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Executive Committee"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Description</label>
            <textarea
              className="form-input w-full min-h-[80px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Sort order</label>
            <input
              type="number"
              min={0}
              className="form-input w-full max-w-[120px]"
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="flex gap-3">
            <button type="submit" disabled={saving} className="btn-primary px-4 py-2 text-sm disabled:opacity-50">
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
            </button>
            <button type="button" onClick={resetForm} className="btn-secondary px-4 py-2 text-sm">Cancel</button>
          </div>
        </form>
      )}

      <div className="card overflow-hidden">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-neutral-900">Meeting types</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">
            No meeting types yet. Add one to use when creating meeting events.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Sort</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((mt) => (
                  <tr key={mt.id}>
                    <td className="font-medium text-neutral-900">{mt.name}</td>
                    <td className="text-sm text-neutral-600 max-w-[200px] truncate">{mt.description || "—"}</td>
                    <td className="text-sm text-neutral-600">{mt.sort_order ?? "—"}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleEdit(mt)} className="text-sm font-semibold text-primary hover:underline mr-3">
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDelete(mt)} className="text-sm font-semibold text-red-600 hover:underline">
                        Delete
                      </button>
                    </td>
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
