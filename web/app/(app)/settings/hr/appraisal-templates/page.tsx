"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrAppraisalTemplate } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

const CYCLE_LABELS: Record<HrAppraisalTemplate["cycle_frequency"], string> = {
  annual: "Annual",
  bi_annual: "Bi-Annual",
  quarterly: "Quarterly",
};

function AppraisalTemplateModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrAppraisalTemplate> | null;
  onClose: () => void;
  onSave: (data: Partial<HrAppraisalTemplate>) => void;
}) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState<Partial<HrAppraisalTemplate>>(
    item ?? {
      name: "",
      description: "",
      cycle_frequency: "annual",
      rating_scale_max: 5,
      kra_count_default: 5,
      is_probation_template: false,
      is_active: true,
    }
  );

  const set = <K extends keyof HrAppraisalTemplate>(key: K, val: HrAppraisalTemplate[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? "Edit Appraisal Template" : "New Appraisal Template"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Name *</label>
            <input
              className="form-input text-sm"
              value={form.name ?? ""}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Annual Staff Appraisal"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Description</label>
            <textarea
              className="form-input text-sm resize-none"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional description…"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Cycle Frequency</label>
            <select
              className="form-input text-sm"
              value={form.cycle_frequency ?? "annual"}
              onChange={(e) => set("cycle_frequency", e.target.value as HrAppraisalTemplate["cycle_frequency"])}
            >
              <option value="annual">Annual</option>
              <option value="bi_annual">Bi-Annual</option>
              <option value="quarterly">Quarterly</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Rating Scale Max</label>
              <input
                type="number"
                className="form-input text-sm"
                min={2}
                max={10}
                value={form.rating_scale_max ?? 5}
                onChange={(e) => set("rating_scale_max", parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-neutral-400 mt-1">e.g. 5 = rated 1–5</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Default KRA Count</label>
              <input
                type="number"
                className="form-input text-sm"
                min={1}
                max={20}
                value={form.kra_count_default ?? 5}
                onChange={(e) => set("kra_count_default", parseInt(e.target.value) || 5)}
              />
              <p className="text-xs text-neutral-400 mt-1">Key Result Areas</p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">Probation Template</p>
              <p className="text-xs text-neutral-500">Used for staff on probation</p>
            </div>
            <button
              type="button"
              onClick={() => set("is_probation_template", !form.is_probation_template)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                form.is_probation_template ? "bg-primary" : "bg-neutral-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  form.is_probation_template ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Status</label>
            <select
              className="form-input text-sm"
              value={form.is_active ? "active" : "inactive"}
              onChange={(e) => set("is_active", e.target.value === "active")}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? "Save Changes" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppraisalTemplatesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Partial<HrAppraisalTemplate> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "appraisal-templates"],
    queryFn: () => hrSettingsApi.listAppraisalTemplates().then((r) => (r.data as any).data as HrAppraisalTemplate[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrAppraisalTemplate>) =>
      form.id
        ? hrSettingsApi.updateAppraisalTemplate(form.id, form).then((r) => r.data)
        : hrSettingsApi.createAppraisalTemplate(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "appraisal-templates"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteAppraisalTemplate(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", "Appraisal template deleted.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "appraisal-templates"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Cannot delete."),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <AppraisalTemplateModal
          item={modal}
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
            <span className="text-neutral-700 font-medium">Appraisal Templates</span>
          </div>
          <h1 className="page-title">Appraisal Templates</h1>
          <p className="page-subtitle">Define appraisal cycles, rating scales, KRA counts, and template configurations.</p>
        </div>
        <button onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Template
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {items.length} {items.length === 1 ? "template" : "templates"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">rate_review</span>
            <p className="mt-2 text-sm text-neutral-500">No appraisal templates yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Name</th>
                <th>Cycle</th>
                <th>Rating Scale</th>
                <th>KRAs</th>
                <th>Probation Template?</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <p className="font-medium text-sm text-neutral-900">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-neutral-500 truncate max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td>
                    <span className="badge badge-primary">
                      {CYCLE_LABELS[item.cycle_frequency]}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">1 – {item.rating_scale_max}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{item.kra_count_default}</span>
                  </td>
                  <td>
                    {item.is_probation_template ? (
                      <span className="badge badge-warning">Yes</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td>
                    <span className={cn("badge", item.is_active ? "badge-success" : "badge-muted")}>
                      {item.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal(item)}
                        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title="Edit"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {deleting === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
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
                          onClick={() => setDeleting(item.id)}
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
