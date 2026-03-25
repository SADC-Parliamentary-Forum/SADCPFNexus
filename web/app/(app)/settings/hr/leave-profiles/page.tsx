"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrLeaveProfile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";

function LeaveProfileModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrLeaveProfile> | null;
  onClose: () => void;
  onSave: (data: Partial<HrLeaveProfile>) => void;
}) {
  const isEdit = !!item?.id;
  const [form, setForm] = useState<Partial<HrLeaveProfile>>(
    item ?? {
      profile_code: "",
      profile_name: "",
      annual_leave_days: 21,
      sick_leave_days: 30,
      lil_days: 10,
      special_leave_days: 5,
      maternity_days: 84,
      paternity_days: 5,
      is_active: true,
    }
  );

  const set = <K extends keyof HrLeaveProfile>(key: K, val: HrLeaveProfile[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? "Edit Leave Profile" : "New Leave Profile"}
          </h3>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Profile Code *</label>
              <input
                className="form-input text-sm uppercase"
                value={form.profile_code ?? ""}
                onChange={(e) => set("profile_code", e.target.value.toUpperCase())}
                placeholder="e.g. STD-LOCAL"
                maxLength={20}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">Profile Name *</label>
              <input
                className="form-input text-sm"
                value={form.profile_name ?? ""}
                onChange={(e) => set("profile_name", e.target.value)}
                placeholder="e.g. Standard Local Staff"
                maxLength={100}
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">Leave Entitlements</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Annual Leave (days)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.annual_leave_days ?? 21}
                  onChange={(e) => set("annual_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Sick Leave (days)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.sick_leave_days ?? 30}
                  onChange={(e) => set("sick_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">LIL Days (Leave in Lieu)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.lil_days ?? 10}
                  onChange={(e) => set("lil_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Special Leave (days)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.special_leave_days ?? 5}
                  onChange={(e) => set("special_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Maternity Leave (days)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  min={0}
                  value={form.maternity_days ?? 84}
                  onChange={(e) => set("maternity_days", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">Paternity Leave (days)</label>
                <input
                  type="number"
                  className="form-input text-sm"
                  min={0}
                  value={form.paternity_days ?? 5}
                  onChange={(e) => set("paternity_days", parseInt(e.target.value) || 0)}
                />
              </div>
            </div>
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

export default function LeaveProfilesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [modal, setModal] = useState<Partial<HrLeaveProfile> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "leave-profiles"],
    queryFn: () => hrSettingsApi.listLeaveProfiles().then((r) => (r.data as any).data as HrLeaveProfile[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrLeaveProfile>) =>
      form.id
        ? hrSettingsApi.updateLeaveProfile(form.id, form).then((r) => r.data)
        : hrSettingsApi.createLeaveProfile(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? "Saved.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "leave-profiles"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Failed to save."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteLeaveProfile(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", "Leave profile deleted.");
      qc.invalidateQueries({ queryKey: ["hr-settings", "leave-profiles"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? "Cannot delete."),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <LeaveProfileModal
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
            <span className="text-neutral-700 font-medium">Leave Profiles</span>
          </div>
          <h1 className="page-title">Leave Profiles</h1>
          <p className="page-subtitle">Set leave day entitlements by grade category for each leave type.</p>
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
            {items.length} leave {items.length === 1 ? "profile" : "profiles"}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <span className="material-symbols-outlined text-[40px] text-neutral-300">event_available</span>
            <p className="mt-2 text-sm text-neutral-500">No leave profiles yet. Create one to get started.</p>
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Profile Name</th>
                <th>Annual</th>
                <th>Sick</th>
                <th>LIL</th>
                <th>Maternity / Paternity</th>
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
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{item.annual_leave_days}d</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{item.sick_leave_days}d</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{item.lil_days}d</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {item.maternity_days}d / {item.paternity_days}d
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
