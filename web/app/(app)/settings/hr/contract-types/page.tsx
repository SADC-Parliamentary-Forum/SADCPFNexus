"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrContractType } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
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
            {isEdit ? t("settings.hr.contract.edit") : t("settings.hr.contract.new")}
          </h3>
          <button onClick={onClose} aria-label={t("settings.hr.contract.closeEditor")} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="settings-hr-contract-types-code" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.codeRequired")}</label>
              <input id="settings-hr-contract-types-code"
                className="form-input text-sm uppercase"
                value={form.code ?? ""}
                onChange={(e) => set("code", e.target.value.toUpperCase())}
                placeholder={t("settings.hr.contract.codePlaceholder")}
                maxLength={20}
              />
            </div>
            <div>
              <label htmlFor="settings-hr-contract-types-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.nameRequired")}</label>
              <input id="settings-hr-contract-types-name"
                className="form-input text-sm"
                value={form.name ?? ""}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("settings.hr.contract.namePlaceholder")}
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label htmlFor="settings-hr-contract-types-description" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.description")}</label>
            <textarea id="settings-hr-contract-types-description"
              className="form-input text-sm resize-none"
              rows={2}
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value)}
              placeholder={t("settings.hr.common.descriptionPlaceholder")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">{t("settings.hr.contract.isPermanent")}</p>
              <p className="text-xs text-neutral-500">{t("settings.hr.contract.isPermanentHint")}</p>
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
                <p className="text-sm font-medium text-neutral-800">{t("settings.hr.contract.hasProbation")}</p>
                <p className="text-xs text-neutral-500">{t("settings.hr.contract.hasProbationHint")}</p>
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
              <label htmlFor="settings-hr-contract-types-probation-months" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.contract.probationMonths")}</label>
              <input id="settings-hr-contract-types-probation-months"
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
            <label htmlFor="settings-hr-contract-types-notice-period-days" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.contract.noticeDays")}</label>
            <input id="settings-hr-contract-types-notice-period-days"
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
              <p className="text-sm font-medium text-neutral-800">{t("settings.hr.contract.isRenewable")}</p>
              <p className="text-xs text-neutral-500">{t("settings.hr.contract.isRenewableHint")}</p>
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
            <label htmlFor="settings-hr-contract-types-status" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.status")}</label>
            <select id="settings-hr-contract-types-status"
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
            disabled={!form.code || !form.name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? t("settings.hr.common.saveChanges") : t("settings.hr.contract.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ContractTypesPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
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
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "contract-types"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteContractType(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", t("settings.hr.contract.deleted"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "contract-types"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.cannotDelete")),
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
      <HrSettingsHeader
        title={t("settings.hr.home.contractTypes.title")}
        subtitle={t("settings.hr.contract.subtitle")}
        actions={
          <button type="button" onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("settings.hr.contract.new")}
        </button>
        }
      />


      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {t(items.length === 1 ? "settings.hr.contract.countOne" : "settings.hr.contract.countMany", { count: items.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="description" title={t("settings.hr.contract.emptyTitle")} description={t("settings.hr.common.emptyDescription")} />
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("settings.hr.common.code")}</th>
                <th>{t("settings.hr.common.name")}</th>
                <th>{t("settings.hr.contract.type")}</th>
                <th>{t("settings.hr.contract.probation")}</th>
                <th>{t("settings.hr.contract.noticePeriod")}</th>
                <th>{t("settings.hr.contract.renewable")}</th>
                <th>{t("settings.hr.common.status")}</th>
                <th className="w-24">{t("settings.hr.common.actions")}</th>
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
                      {item.is_permanent ? t("settings.hr.contract.permanent") : t("settings.hr.contract.fixedTerm")}
                    </span>
                  </td>
                  <td>
                    {item.has_probation ? (
                      <span className="text-sm text-neutral-700">{t("settings.hr.contract.months", { count: item.probation_months ?? 0 })}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{t("settings.hr.contract.days", { count: item.notice_period_days ?? 0 })}</span>
                  </td>
                  <td>
                    {item.is_renewable ? (
                      <span className="badge badge-success">{t("settings.hr.common.yes")}</span>
                    ) : (
                      <span className="badge badge-muted">{t("settings.hr.common.no")}</span>
                    )}
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
