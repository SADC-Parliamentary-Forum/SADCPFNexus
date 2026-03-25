"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrJobFamily } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const ICON_OPTIONS = [
  "star", "gavel", "account_balance", "people", "computer",
  "shopping_cart", "engineering", "medical_services", "language", "policy",
];

const COLOR_OPTIONS = [
  "#1d85ed", "#7c3aed", "#059669", "#db2777", "#d97706",
  "#2563eb", "#0891b2", "#dc2626", "#65a30d", "#475569",
];

function FamilyModal({
  family,
  onClose,
  onSave,
}: {
  family: Partial<HrJobFamily> | null;
  onClose: () => void;
  onSave: (data: Partial<HrJobFamily>) => void;
}) {
  const isEdit = !!family?.id;
  const [form, setForm] = useState<Partial<HrJobFamily>>(
    family ?? { name: "", code: "", description: "", color: "#1d85ed", icon: "work", status: "active" }
  );

  const set = (key: keyof HrJobFamily, val: string) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? "Edit Job Family" : "New Job Family"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Name *</label>
              <input className="form-input text-sm" value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Finance & Accounting" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
              <input className="form-input text-sm uppercase" value={form.code ?? ""} onChange={(e) => set("code", e.target.value.toUpperCase())} placeholder="e.g. FIN" maxLength={20} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
            <textarea className="form-input text-sm resize-none" rows={2} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} placeholder="Optional description…" />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Colour</label>
            <div className="flex gap-2 flex-wrap">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => set("color", c)}
                  className={cn("w-7 h-7 rounded-full border-2 transition-transform hover:scale-110", form.color === c ? "border-neutral-700 scale-110" : "border-transparent")}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Icon</label>
            <div className="flex gap-2 flex-wrap">
              {ICON_OPTIONS.map((ic) => (
                <button
                  key={ic}
                  type="button"
                  onClick={() => set("icon", ic)}
                  className={cn("w-9 h-9 rounded-lg flex items-center justify-center border transition-colors", form.icon === ic ? "border-primary bg-primary/10 text-primary" : "border-neutral-200 text-neutral-600 hover:bg-neutral-50")}
                >
                  <span className="material-symbols-outlined text-[18px]">{ic}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Status</label>
            <select className="form-input text-sm" value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name || !form.code}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? "Save Changes" : "Create Family"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function JobFamiliesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Partial<HrJobFamily> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "job-families"],
    queryFn: () => hrSettingsApi.listJobFamilies().then((r) => (r.data as any).data as HrJobFamily[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrJobFamily>) =>
      form.id
        ? hrSettingsApi.updateJobFamily(form.id, form).then((r) => r.data)
        : hrSettingsApi.createJobFamily(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast({ title: res.message ?? "Saved.", type: "success" });
      qc.invalidateQueries({ queryKey: ["hr-settings", "job-families"] });
      setModal(undefined);
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Failed to save.", type: "error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteJobFamily(id).then((r) => r.data),
    onSuccess: () => {
      toast({ title: "Job family deleted.", type: "success" });
      qc.invalidateQueries({ queryKey: ["hr-settings", "job-families"] });
      setDeleting(null);
    },
    onError: (e: any) => toast({ title: e?.response?.data?.message ?? "Cannot delete.", type: "error" }),
  });

  const families = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <FamilyModal
          family={modal}
          onClose={() => setModal(undefined)}
          onSave={(form) => saveMutation.mutate(form)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-neutral-500 mb-1">
            <a href="/settings/hr" className="hover:text-primary">HR Administration</a>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Job Families</span>
          </div>
          <h1 className="page-title">Job Families</h1>
          <p className="page-subtitle">Group positions into functional families used for competency mapping and appraisals.</p>
        </div>
        <button onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Family
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {families.length} job {families.length === 1 ? "family" : "families"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : families.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">category</span>
            <p className="mt-2 text-sm text-neutral-500">No job families yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Family</th>
                <th>Code</th>
                <th>Grade Bands</th>
                <th>Status</th>
                <th className="w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {families.map((f) => (
                <tr key={f.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ backgroundColor: (f.color ?? "#1d85ed") + "20" }}
                      >
                        <span
                          className="material-symbols-outlined text-[16px]"
                          style={{ color: f.color ?? "#1d85ed" }}
                        >
                          {f.icon ?? "category"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-sm text-neutral-900">{f.name}</p>
                        {f.description && (
                          <p className="text-xs text-neutral-500 truncate max-w-xs">{f.description}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">{f.code}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{f.grade_bands_count ?? 0}</span>
                  </td>
                  <td>
                    <span className={cn("badge", f.status === "active" ? "badge-success" : "badge-muted")}>
                      {f.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal(f)}
                        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {deleting === f.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(f.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 text-xs font-medium"
                          >
                            Confirm
                          </button>
                          <button onClick={() => setDeleting(null)} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 text-xs">
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleting(f.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600"
                          title="Delete"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
