"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  salaryAssignmentApi,
  hrSettingsApi,
  tenantUsersApi,
  type EmployeeSalaryAssignment,
  type TenantUserOption,
} from "@/lib/api";
import { formatDate } from "@/lib/utils";

type GradeBand = { id: number; code: string; label: string; salary_scales?: SalaryScale[] };
type SalaryScale = { id: number; grade_band_id: number; status: string; notches?: { notch: number; monthly: number }[] };

function fmt2(n: number) {
  return Number(n).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export default function SalaryAssignmentsPage() {
  const [assignments, setAssignments] = useState<EmployeeSalaryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [gradeBands, setGradeBands] = useState<GradeBand[]>([]);
  const [users, setUsers] = useState<TenantUserOption[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    user_id: "",
    grade_band_id: "",
    salary_scale_id: "",
    notch_number: "1",
    effective_from: new Date().toISOString().slice(0, 10),
    effective_to: "",
    employment_type: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [filterUserId, setFilterUserId] = useState("");

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = filterUserId ? { user_id: Number(filterUserId) } : undefined;
      const res = await salaryAssignmentApi.list(params);
      setAssignments(res.data.data ?? []);
    } catch {
      setError("Failed to load salary assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // Load grade bands and users for the form
    hrSettingsApi.listGradeBands?.().then((r) => setGradeBands((r.data as any).data ?? r.data ?? [])).catch(() => {});
    tenantUsersApi.list().then((r) => {
      const d = (r.data as any).data ?? r.data;
      setUsers(Array.isArray(d) ? d : []);
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const openCreate = () => {
    setEditId(null);
    setForm({ user_id: "", grade_band_id: "", salary_scale_id: "", notch_number: "1", effective_from: new Date().toISOString().slice(0, 10), effective_to: "", employment_type: "", notes: "" });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = (a: EmployeeSalaryAssignment) => {
    setEditId(a.id);
    setForm({
      user_id: String(a.user_id),
      grade_band_id: String(a.grade_band_id),
      salary_scale_id: a.salary_scale_id ? String(a.salary_scale_id) : "",
      notch_number: String(a.notch_number),
      effective_from: a.effective_from.slice(0, 10),
      effective_to: a.effective_to?.slice(0, 10) ?? "",
      employment_type: a.employment_type ?? "",
      notes: a.notes ?? "",
    });
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      const payload = {
        user_id: Number(form.user_id),
        grade_band_id: Number(form.grade_band_id),
        salary_scale_id: form.salary_scale_id ? Number(form.salary_scale_id) : undefined,
        notch_number: Number(form.notch_number),
        effective_from: form.effective_from,
        effective_to: form.effective_to || undefined,
        employment_type: form.employment_type || undefined,
        notes: form.notes || undefined,
      };
      if (editId) {
        await salaryAssignmentApi.update(editId, payload);
      } else {
        await salaryAssignmentApi.create(payload);
      }
      setShowModal(false);
      load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Save failed.";
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (!confirm("Remove this salary assignment?")) return;
    await salaryAssignmentApi.remove(id);
    load();
  };

  const selectedBand = gradeBands.find((b) => String(b.id) === form.grade_band_id);
  const availableScales = selectedBand?.salary_scales?.filter((s) => s.status === "published") ?? [];

  return (
    <div className="p-6 space-y-5 max-w-5xl">
      {/* Breadcrumb */}
      <nav className="text-sm text-neutral-500 flex items-center gap-1 flex-wrap">
        <Link href="/admin" className="hover:text-primary">Admin</Link>
        <span className="material-symbols-outlined text-xs">chevron_right</span>
        <span className="text-neutral-800 font-medium">Salary Assignments</span>
      </nav>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Employee Salary Assignments</h1>
          <p className="page-subtitle">Link each employee to their grade band and notch for payslip auto-fill.</p>
        </div>
        <button onClick={openCreate} className="btn-primary text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-base">add</span>
          Assign Grade
        </button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <select
          className="form-input text-sm w-56"
          value={filterUserId}
          onChange={(e) => setFilterUserId(e.target.value)}
        >
          <option value="">All employees</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <button onClick={load} className="btn-secondary text-sm px-3 py-2">Apply</button>
      </div>

      {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">{error}</div>}

      <div className="card overflow-hidden">
        <table className="data-table w-full">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Grade Band</th>
              <th>Notch</th>
              <th>Employment Type</th>
              <th>Effective From</th>
              <th>Effective To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              [...Array(4)].map((_, i) => (
                <tr key={i}>
                  {[...Array(7)].map((_, j) => <td key={j}><div className="h-3 bg-neutral-100 rounded animate-pulse" /></td>)}
                </tr>
              ))
            ) : assignments.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-12 text-neutral-400 text-sm">No salary assignments found.</td></tr>
            ) : assignments.map((a) => (
              <tr key={a.id} className="hover:bg-neutral-50">
                <td className="text-sm font-medium">{a.employee?.name ?? `#${a.user_id}`}</td>
                <td className="text-sm">{a.grade_band?.code ?? a.grade_band?.label ?? `#${a.grade_band_id}`}</td>
                <td className="text-sm">Notch {a.notch_number}</td>
                <td className="text-sm text-neutral-500">{a.employment_type ?? "—"}</td>
                <td className="text-sm text-neutral-500">{formatDate(a.effective_from)}</td>
                <td className="text-sm text-neutral-500">{a.effective_to ? formatDate(a.effective_to) : "Open"}</td>
                <td>
                  <div className="flex items-center gap-3">
                    <button onClick={() => openEdit(a)} className="text-xs text-primary hover:underline">Edit</button>
                    <button onClick={() => handleRemove(a.id)} className="text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
            <h2 className="text-base font-semibold text-neutral-900">{editId ? "Edit" : "Assign"} Grade Band</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Employee <span className="text-red-500">*</span></label>
                <select className="form-input w-full" value={form.user_id} onChange={(e) => setForm((f) => ({ ...f, user_id: e.target.value }))} required disabled={!!editId}>
                  <option value="">Select employee…</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Grade Band <span className="text-red-500">*</span></label>
                  <select className="form-input w-full" value={form.grade_band_id} onChange={(e) => setForm((f) => ({ ...f, grade_band_id: e.target.value, salary_scale_id: "" }))} required>
                    <option value="">Select…</option>
                    {gradeBands.map((b) => <option key={b.id} value={b.id}>{b.code} — {b.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Notch # <span className="text-red-500">*</span></label>
                  <input type="number" min={1} max={30} className="form-input w-full" value={form.notch_number} onChange={(e) => setForm((f) => ({ ...f, notch_number: e.target.value }))} required />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Salary Scale (optional)</label>
                <select className="form-input w-full" value={form.salary_scale_id} onChange={(e) => setForm((f) => ({ ...f, salary_scale_id: e.target.value }))}>
                  <option value="">None</option>
                  {availableScales.map((s) => <option key={s.id} value={s.id}>Scale #{s.id}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Employment Type</label>
                <select className="form-input w-full" value={form.employment_type} onChange={(e) => setForm((f) => ({ ...f, employment_type: e.target.value }))}>
                  <option value="">Not specified</option>
                  <option value="local">Local</option>
                  <option value="regional">Regional</option>
                  <option value="researcher">Researcher</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Effective From <span className="text-red-500">*</span></label>
                  <input type="date" className="form-input w-full" value={form.effective_from} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">Effective To</label>
                  <input type="date" className="form-input w-full" value={form.effective_to} onChange={(e) => setForm((f) => ({ ...f, effective_to: e.target.value }))} />
                </div>
              </div>
              {formError && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{formError}</div>}
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary text-sm">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
                  {submitting ? "Saving…" : editId ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
