"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrAllowanceProfile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

function AllowanceProfileModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrAllowanceProfile> | null;
  onClose: () => void;
  onSave: (data: Partial<HrAllowanceProfile>) => void;
}) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState<Partial<HrAllowanceProfile>>(
    item ?? {
      profile_code: "",
      profile_name: "",
      currency: "NAD",
      transport_allowance: 0,
      housing_allowance: 0,
      communication_allowance: 0,
      medical_allowance: 0,
      subsistence_allowance: 0,
      notes: "",
      is_active: true,
    }
  );

  const set = <K extends keyof HrAllowanceProfile>(key: K, val: HrAllowanceProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? "Edit Allowance Profile" : "New Allowance Profile"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Code *</label>
              <input
                className="form-input text-sm uppercase"
                value={form.profile_code ?? ""}
                onChange={(e) => set("profile_code", e.target.value.toUpperCase())}
                placeholder="e.g. STD-A"
                maxLength={20}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-neutral-700 mb-1">Profile Name *</label>
              <input
                className="form-input text-sm"
                value={form.profile_name ?? ""}
                onChange={(e) => set("profile_name", e.target.value)}
                placeholder="e.g. Standard Grade A"
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Currency</label>
            <input
              className="form-input text-sm uppercase"
              value={form.currency ?? "NAD"}
              onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))}
              placeholder="NAD"
              maxLength={3}
            />
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Monthly Allowances</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Transport</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.transport_allowance ?? 0}
                  onChange={(e) => set("transport_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Housing</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.housing_allowance ?? 0}
                  onChange={(e) => set("housing_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Communication</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.communication_allowance ?? 0}
                  onChange={(e) => set("communication_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Medical</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.medical_allowance ?? 0}
                  onChange={(e) => set("medical_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Subsistence</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.subsistence_allowance ?? 0}
                  onChange={(e) => set("subsistence_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div className="flex items-end">
                <div className="rounded-lg bg-primary/5 border border-primary/20 px-3 py-2 w-full">
                  <p className="text-xs text-neutral-500">Total Monthly</p>
                  <p className="text-sm font-semibold text-primary">
                    {(form.currency ?? "NAD")}{" "}
                    {(
                      (form.transport_allowance ?? 0) +
                      (form.housing_allowance ?? 0) +
                      (form.communication_allowance ?? 0) +
                      (form.medical_allowance ?? 0) +
                      (form.subsistence_allowance ?? 0)
                    ).toLocaleString("en-NA", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 mb-1">Notes</label>
            <textarea
              className="form-input text-sm resize-none"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes…"
            />
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
            disabled={!form.profile_code || !form.profile_name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? "Save Changes" : "Create Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function totalAllowance(item: HrAllowanceProfile) {
  return (
    item.transport_allowance +
    item.housing_allowance +
    item.communication_allowance +
    item.medical_allowance +
    item.subsistence_allowance
  );
}

export default function AllowanceProfilesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Partial<HrAllowanceProfile> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "allowance-profiles"],
    queryFn: () => hrSettingsApi.listAllowanceProfiles().then((r) => (r.data as any).data as HrAllowanceProfile[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrAllowanceProfile>) =>
      form.id
        ? hrSettingsApi.updateAllowanceProfile(form.id, form).then((r) => r.data)
        : hrSettingsApi.createAllowanceProfile(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "allowance-profiles"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteAllowanceProfile(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", "Allowance profile deleted.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "allowance-profiles"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Cannot delete."),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <AllowanceProfileModal
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
            <span className="text-neutral-700 font-medium">Allowance Profiles</span>
          </div>
          <h1 className="page-title">Allowance Profiles</h1>
          <p className="page-subtitle">Configure transport, housing, communication, and subsistence allowance rules by grade.</p>
        </div>
        <button onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Profile
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {items.length} allowance {items.length === 1 ? "profile" : "profiles"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">attach_money</span>
            <p className="mt-2 text-sm text-neutral-500">No allowance profiles yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Profile Name</th>
                <th>Currency</th>
                <th>Transport</th>
                <th>Housing</th>
                <th>Total Monthly</th>
                <th>Status</th>
                <th className="w-24">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="font-mono text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                      {item.profile_code}
                    </span>
                  </td>
                  <td>
                    <p className="font-medium text-sm text-neutral-900">{item.profile_name}</p>
                    {item.notes && (
                      <p className="text-xs text-neutral-500 truncate max-w-xs">{item.notes}</p>
                    )}
                  </td>
                  <td>
                    <span className="text-sm font-medium text-neutral-700">{item.currency}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {item.transport_allowance.toLocaleString("en-NA", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {item.housing_allowance.toLocaleString("en-NA", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm font-semibold text-neutral-900">
                      {totalAllowance(item).toLocaleString("en-NA", { minimumFractionDigits: 2 })}
                    </span>
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
