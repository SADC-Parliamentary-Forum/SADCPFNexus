"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrLeaveProfile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
            {isEdit ? t("settings.hr.leaveProfile.edit") : t("settings.hr.leaveProfile.new")}
          </h3>
          <button onClick={onClose} aria-label={t("settings.hr.leaveProfile.closeEditor")} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-hr-leave-profiles-profile-code" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.codeRequired")}</label>
              <input id="settings-hr-leave-profiles-profile-code"
                className="form-input text-sm uppercase"
                value={form.profile_code ?? ""}
                onChange={(e) => set("profile_code", e.target.value.toUpperCase())}
                placeholder={t("settings.hr.leaveProfile.codePlaceholder")}
                maxLength={20}
              />
            </div>
            <div>
              <label htmlFor="settings-hr-leave-profiles-profile-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.nameRequired")}</label>
              <input id="settings-hr-leave-profiles-profile-name"
                className="form-input text-sm"
                value={form.profile_name ?? ""}
                onChange={(e) => set("profile_name", e.target.value)}
                placeholder={t("settings.hr.leaveProfile.namePlaceholder")}
                maxLength={100}
              />
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{t("settings.hr.leaveProfile.entitlements")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-hr-leave-profiles-annual-leave-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.annualDays")}</label>
                <input id="settings-hr-leave-profiles-annual-leave-days"
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.annual_leave_days ?? 21}
                  onChange={(e) => set("annual_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-leave-profiles-sick-leave-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.sickDays")}</label>
                <input id="settings-hr-leave-profiles-sick-leave-days"
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.sick_leave_days ?? 30}
                  onChange={(e) => set("sick_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-leave-profiles-lil-days-leave-in-lieu" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.lilDays")}</label>
                <input id="settings-hr-leave-profiles-lil-days-leave-in-lieu"
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.lil_days ?? 10}
                  onChange={(e) => set("lil_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-leave-profiles-special-leave-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.specialDays")}</label>
                <input id="settings-hr-leave-profiles-special-leave-days"
                  type="number"
                  className="form-input text-sm"
                  step="0.5"
                  min={0}
                  value={form.special_leave_days ?? 5}
                  onChange={(e) => set("special_leave_days", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-leave-profiles-maternity-leave-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.maternityDays")}</label>
                <input id="settings-hr-leave-profiles-maternity-leave-days"
                  type="number"
                  className="form-input text-sm"
                  min={0}
                  value={form.maternity_days ?? 84}
                  onChange={(e) => set("maternity_days", parseInt(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-leave-profiles-paternity-leave-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.leaveProfile.paternityDays")}</label>
                <input id="settings-hr-leave-profiles-paternity-leave-days"
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
            <label htmlFor="settings-hr-leave-profiles-status" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.status")}</label>
            <select id="settings-hr-leave-profiles-status"
              className="form-input text-sm"
              value={form.is_active ? "active" : "inactive"}
              onChange={(e) => set("is_active", e.target.value === "active")}
            >
              <option value="active">{t("settings.hr.common.active")}</option>
              <option value="inactive">{t("settings.hr.common.inactive")}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="btn-secondary flex-1 text-sm">{t("common.cancel")}</button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.profile_code || !form.profile_name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? t("settings.hr.common.saveChanges") : t("settings.hr.allowance.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LeaveProfilesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
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
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "leave-profiles"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteLeaveProfile(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", t("settings.hr.leaveProfile.deleted"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "leave-profiles"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.cannotDelete")),
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
      <HrSettingsHeader
        title={t("settings.hr.home.leaveProfiles.title")}
        subtitle={t("settings.hr.home.leaveProfiles.description")}
        actions={
          <button type="button" onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("settings.hr.allowance.newProfile")}
        </button>
        }
      />


      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {t(items.length === 1 ? "settings.hr.leaveProfile.countOne" : "settings.hr.leaveProfile.countMany", { count: items.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="event_available" title={t("settings.hr.leaveProfile.emptyTitle")} description={t("settings.hr.common.emptyDescription")} />
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("settings.hr.common.code")}</th>
                <th>{t("settings.hr.allowance.name")}</th>
                <th>{t("leave.type.annual")}</th>
                <th>{t("leave.type.sick")}</th>
                <th>{t("settings.hr.leaveProfile.lil")}</th>
                <th>{t("settings.hr.leaveProfile.maternityPaternity")}</th>
                <th>{t("settings.hr.common.status")}</th>
                <th className="w-24">{t("settings.hr.common.actions")}</th>
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
                    <span className="text-sm text-neutral-700">{t("settings.hr.leaveProfile.daysShort", { count: item.annual_leave_days })}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{t("settings.hr.leaveProfile.daysShort", { count: item.sick_leave_days })}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{t("settings.hr.leaveProfile.daysShort", { count: item.lil_days })}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {t("settings.hr.leaveProfile.daysShort", { count: item.maternity_days })} / {t("settings.hr.leaveProfile.daysShort", { count: item.paternity_days })}
                    </span>
                  </td>
                  <td>
                    <span className={cn("badge", item.is_active ? "badge-success" : "badge-muted")}>
                      {item.is_active ? t("settings.hr.common.active") : t("settings.hr.common.inactive")}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setModal(item)}
                        className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 hover:text-primary"
                        title={t("common.edit")}
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                      </button>
                      {deleting === item.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteMutation.mutate(item.id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-600 text-xs font-medium"
                          >
                            {t("common.confirm")}
                          </button>
                          <button onClick={() => setDeleting(null)} className="p-1.5 rounded hover:bg-neutral-100 text-neutral-500 text-xs">
                            {t("common.cancel")}
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleting(item.id)}
                          className="p-1.5 rounded hover:bg-red-50 text-neutral-500 hover:text-red-600"
                          title={t("common.delete")}
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
