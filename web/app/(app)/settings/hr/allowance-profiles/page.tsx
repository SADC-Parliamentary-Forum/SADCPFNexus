"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrAllowanceProfile } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t, localeTag } = useI18n();
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
            {isEdit ? t("settings.hr.allowance.edit") : t("settings.hr.allowance.new")}
          </h3>
          <button onClick={onClose} aria-label={t("settings.hr.allowance.closeEditor")} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label htmlFor="settings-hr-allowance-profiles-code" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.codeRequired")}</label>
              <input id="settings-hr-allowance-profiles-code"
                className="form-input text-sm uppercase"
                value={form.profile_code ?? ""}
                onChange={(e) => set("profile_code", e.target.value.toUpperCase())}
                placeholder={t("settings.hr.allowance.codePlaceholder")}
                maxLength={20}
              />
            </div>
            <div className="col-span-2">
              <label htmlFor="settings-hr-allowance-profiles-profile-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.nameRequired")}</label>
              <input id="settings-hr-allowance-profiles-profile-name"
                className="form-input text-sm"
                value={form.profile_name ?? ""}
                onChange={(e) => set("profile_name", e.target.value)}
                placeholder={t("settings.hr.allowance.namePlaceholder")}
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-hr-allowance-profiles-currency" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.currency")}</label>
            <input id="settings-hr-allowance-profiles-currency"
              className="form-input text-sm uppercase"
              value={form.currency ?? "NAD"}
              onChange={(e) => set("currency", e.target.value.toUpperCase().slice(0, 3))}
              placeholder="NAD"
              maxLength={3}
            />
          </div>

          <div className="rounded-lg border border-neutral-200 p-3 space-y-3">
            <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">{t("settings.hr.allowance.monthly")}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="settings-hr-allowance-profiles-transport" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.transport")}</label>
                <input id="settings-hr-allowance-profiles-transport"
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.transport_allowance ?? 0}
                  onChange={(e) => set("transport_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-allowance-profiles-housing" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.housing")}</label>
                <input id="settings-hr-allowance-profiles-housing"
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.housing_allowance ?? 0}
                  onChange={(e) => set("housing_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-allowance-profiles-communication" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.communication")}</label>
                <input id="settings-hr-allowance-profiles-communication"
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.communication_allowance ?? 0}
                  onChange={(e) => set("communication_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-allowance-profiles-medical" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.medical")}</label>
                <input id="settings-hr-allowance-profiles-medical"
                  type="number"
                  className="form-input text-sm"
                  step="0.01"
                  min={0}
                  value={form.medical_allowance ?? 0}
                  onChange={(e) => set("medical_allowance", parseFloat(e.target.value) || 0)}
                />
              </div>
              <div>
                <label htmlFor="settings-hr-allowance-profiles-subsistence" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.allowance.subsistence")}</label>
                <input id="settings-hr-allowance-profiles-subsistence"
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
                  <p className="text-xs text-neutral-500">{t("settings.hr.allowance.totalMonthly")}</p>
                  <p className="text-sm font-semibold text-primary">
                    {(form.currency ?? "NAD")}{" "}
                    {(
                      (form.transport_allowance ?? 0) +
                      (form.housing_allowance ?? 0) +
                      (form.communication_allowance ?? 0) +
                      (form.medical_allowance ?? 0) +
                      (form.subsistence_allowance ?? 0)
                    ).toLocaleString(localeTag, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="settings-hr-allowance-profiles-notes" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.notes")}</label>
            <textarea id="settings-hr-allowance-profiles-notes"
              className="form-input text-sm resize-none"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("settings.hr.common.notesPlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="settings-hr-allowance-profiles-status" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.status")}</label>
            <select id="settings-hr-allowance-profiles-status"
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
  const { t, localeTag } = useI18n();
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
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "allowance-profiles"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteAllowanceProfile(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", t("settings.hr.allowance.deleted"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "allowance-profiles"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.cannotDelete")),
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
      <HrSettingsHeader
        title={t("settings.hr.home.allowanceProfiles.title")}
        subtitle={t("settings.hr.allowance.subtitle")}
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
            {t(items.length === 1 ? "settings.hr.allowance.countOne" : "settings.hr.allowance.countMany", { count: items.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="attach_money" title={t("settings.hr.allowance.emptyTitle")} description={t("settings.hr.common.emptyDescription")} />
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("settings.hr.common.code")}</th>
                <th>{t("settings.hr.allowance.name")}</th>
                <th>{t("settings.hr.allowance.currency")}</th>
                <th>{t("settings.hr.allowance.transport")}</th>
                <th>{t("settings.hr.allowance.housing")}</th>
                <th>{t("settings.hr.allowance.totalMonthly")}</th>
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
                    {item.notes && (
                      <p className="text-xs text-neutral-500 truncate max-w-xs">{item.notes}</p>
                    )}
                  </td>
                  <td>
                    <span className="text-sm font-medium text-neutral-700">{item.currency}</span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {item.transport_allowance.toLocaleString(localeTag, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">
                      {item.housing_allowance.toLocaleString(localeTag, { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <span className="text-sm font-semibold text-neutral-900">
                      {totalAllowance(item).toLocaleString(localeTag, { minimumFractionDigits: 2 })}
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
