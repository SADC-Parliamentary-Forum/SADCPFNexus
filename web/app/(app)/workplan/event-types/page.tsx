"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { workplanEventTypesApi, type WorkplanEventType } from "@/lib/api";

const COLOR_OPTIONS = [
  { value: "neutral", label: "Grey" },
  { value: "primary", label: "Blue" },
  { value: "green",   label: "Green" },
  { value: "amber",   label: "Amber" },
  { value: "red",     label: "Red" },
  { value: "purple",  label: "Purple" },
  { value: "teal",    label: "Teal" },
];

const COLOR_DOT: Record<string, string> = {
  neutral: "bg-neutral-400",
  primary: "bg-primary",
  green:   "bg-green-500",
  amber:   "bg-amber-500",
  red:     "bg-red-500",
  purple:  "bg-purple-500",
  teal:    "bg-teal-500",
};

export default function WorkplanEventTypesPage() {
  const [list, setList] = useState<WorkplanEventType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("event");
  const [color, setColor] = useState("neutral");
  const [sortOrder, setSortOrder] = useState("");
  const [saving, setSaving] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await workplanEventTypesApi.list();
      setList(res.data?.data ?? []);
    } catch {
      setError("Failed to load event types.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadList(); }, [loadList]);

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setName("");
    setIcon("event");
    setColor("neutral");
    setSortOrder("");
  };

  const handleEdit = (et: WorkplanEventType) => {
    setEditingId(et.id);
    setShowForm(true);
    setName(et.name);
    setIcon(et.icon);
    setColor(et.color);
    setSortOrder(et.sort_order != null ? String(et.sort_order) : "");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      if (editingId) {
        await workplanEventTypesApi.update(editingId, {
          name: name.trim(),
          icon: icon.trim() || undefined,
          color: color || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      } else {
        await workplanEventTypesApi.create({
          name: name.trim(),
          icon: icon.trim() || undefined,
          color: color || undefined,
          sort_order: sortOrder ? Number(sortOrder) : undefined,
        });
      }
      resetForm();
      loadList();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (et: WorkplanEventType) => {
    if (!confirm(`Delete event type "${et.name}"?`)) return; // ship-safe-ignore
    setError(null);
    try {
      await workplanEventTypesApi.delete(et.id);
      loadList();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Cannot delete (may be in use).");
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/workplan" className="text-xs font-medium text-neutral-500 hover:text-neutral-700 mb-1 inline-block">
            Workplan
          </Link>
          <h1 className="page-title">Event types</h1>
          <p className="page-subtitle">
            Define the categories used when creating workplan events. System types cannot be deleted.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { resetForm(); setShowForm(true); }}
          className="btn-primary py-2 px-3 text-sm flex items-center gap-1"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Add event type
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
          <h2 className="text-sm font-semibold text-neutral-900">{editingId ? "Edit event type" : "New event type"}</h2>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Name *</label>
            <input
              type="text"
              className="form-input w-full"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Workshop"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Icon</label>
              <input
                type="text"
                className="form-input w-full font-mono text-sm"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="e.g. event"
              />
              <p className="text-xs text-neutral-400 mt-1">Material Symbol icon name</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Colour</label>
              <select className="form-input w-full" value={color} onChange={(e) => setColor(e.target.value)}>
                {COLOR_OPTIONS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
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
        <div className="px-5 py-4 border-b border-neutral-100">
          <h3 className="text-sm font-semibold text-neutral-900">Event types</h3>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
            <span className="ml-2">Loading…</span>
          </div>
        ) : list.length === 0 ? (
          <div className="py-12 text-center text-sm text-neutral-500">No event types found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Slug</th>
                  <th>Icon</th>
                  <th>Colour</th>
                  <th>Sort</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((et) => (
                  <tr key={et.id}>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className={`h-2 w-2 rounded-full ${COLOR_DOT[et.color] ?? "bg-neutral-400"}`} />
                        <span className="font-medium text-neutral-900">{et.name}</span>
                        {et.is_system && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
                            <span className="material-symbols-outlined text-[11px]">lock</span>
                            system
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="font-mono text-xs text-neutral-500">{et.slug}</td>
                    <td>
                      <span className="material-symbols-outlined text-neutral-500 text-[18px]">{et.icon}</span>
                    </td>
                    <td className="text-sm text-neutral-600 capitalize">{et.color}</td>
                    <td className="text-sm text-neutral-600">{et.sort_order ?? "—"}</td>
                    <td className="text-right">
                      <button type="button" onClick={() => handleEdit(et)} className="text-sm font-semibold text-primary hover:underline mr-3">
                        Edit
                      </button>
                      {!et.is_system && (
                        <button type="button" onClick={() => handleDelete(et)} className="text-sm font-semibold text-red-600 hover:underline">
                          Delete
                        </button>
                      )}
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
