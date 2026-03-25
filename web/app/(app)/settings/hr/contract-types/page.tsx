"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrContractType } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

function ContractTypeModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrContractType> | null;
  onClose: () => void;
  onSave: (data: Partial<HrContractType>) => void;
}) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState<Partial<HrContractType>>(
    item ?? {
      code: "",
      name: "",
      description: "",
      is_permanent: false,
      has_probation: false,
      probation_months: 3,
      notice_period_days: 30,
      is_renewable: false,
      is_active: true,
    }
  );

  const set = <K extends keyof HrContractType>(key: K, val: HrContractType[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? "Edit Contract Type" : "New Contract Type"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
              <input
                className="form-input text-sm uppercase"
                value={form.code ?? ""}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder="e.g. PERM"
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Name *</label>
              <input
                className="form-input text-sm"
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Permanent"
                maxLength={100}
              />
            </div>
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

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">Is Permanent</p>
              <p className="text-xs text-neutral-500">Indefinite employment (no fixed end date)</p>
            </div>
            <button
              type="button"
              onClick={() => set("is_permanent", !form.is_permanent)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                form.is_permanent ? "bg-primary" : "bg-neutral-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  form.is_permanent ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          {!form.is_permanent && (
            <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-neutral-800">Has Probation</p>
                <p className="text-xs text-neutral-500">Includes a probationary period</p>
              </div>
              <button
                type="button"
                onClick={() => set("has_probation", !form.has_probation)}
                className={cn(
                  "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                  form.has_probation ? "bg-primary" : "bg-neutral-300"
                )}
              >
                <span
                  className={cn(
                    "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                    form.has_probation ? "translate-x-4" : "translate-x-0"
                  )}
                />
              </button>
            </div>
          )}

          {!form.is_permanent && form.has_probation && (
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Probation Months</label>
              <input
                type="number"
                className="form-input text-sm"
                min={1}
                max={24}
                value={form.probation_months ?? 3}
                onChange={(e) => set("probation_months", parseInt(e.target.value) || 3)}
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Notice Period (days) *</label>
            <input
              type="number"
              className="form-input text-sm"
              min={1}
              max={365}
              value={form.notice_period_days ?? 30}
              onChange={(e) => set("notice_period_days", parseInt(e.target.value) || 30)}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">Is Renewable</p>
              <p className="text-xs text-neutral-500">Contract can be renewed upon expiry</p>
            </div>
            <button
              type="button"
              onClick={() => set("is_renewable", !form.is_renewable)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                form.is_renewable ? "bg-primary" : "bg-neutral-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  form.is_renewable ? "translate-x-4" : "translate-x-0"
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
            disabled={!form.code || !form.name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? "Save Changes" : "Create Contract Type"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContractTypesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Partial<HrContractType> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "contract-types"],
    queryFn: () => hrSettingsApi.listContractTypes().then((r) => (r.data as any).data as HrContractType[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrContractType>) =>
      form.id
        ? hrSettingsApi.updateContractType(form.id, form).then((r) => r.data)
        : hrSettingsApi.createContractType(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "contract-types"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteContractType(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", "Contract type deleted.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "contract-types"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Cannot delete."),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <ContractTypeModal
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
            <span className="text-neutral-700 font-medium">Contract Types</span>
          </div>
          <h1 className="page-title">Contract Types</h1>
          <p className="page-subtitle">Define employment contract templates — permanent, fixed-term, temporary, and consultancy.</p>
        </div>
        <button onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Contract Type
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {items.length} contract {items.length === 1 ? "type" : "types"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">description</span>
            <p className="mt-2 text-sm text-neutral-500">No contract types yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Probation</th>
                <th>Notice Period</th>
                <th>Renewable</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="font-mono text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                      {item.code}
                    </span>
                  </td>
                  <td>
                    <p className="font-medium text-sm text-neutral-900">{item.name}</p>
                    {item.description && (
                      <p className="text-xs text-neutral-500 truncate max-w-xs">{item.description}</p>
                    )}
                  </td>
                  <td>
                    <span className={cn("badge", item.is_permanent ? "badge-primary" : "badge-muted")}>
                      {item.is_permanent ? "Permanent" : "Fixed-term"}
                    </span>
                  </td>
                  <td>
                    {item.has_probation ? (
                      <span className="text-sm text-neutral-700">{item.probation_months} months</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{item.notice_period_days} days</span>
                  </td>
                  <td>
                    {item.is_renewable ? (
                      <span className="badge badge-success">Yes</span>
                    ) : (
                      <span className="badge badge-muted">No</span>
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
