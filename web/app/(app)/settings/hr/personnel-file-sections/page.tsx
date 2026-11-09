"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrPersonnelFileSection } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const VISIBILITY_LABELS: Record<HrPersonnelFileSection["visibility"], string> = {
  employee: "settings.hr.fileSection.visibility.employee",
  hr_only: "settings.hr.fileSection.visibility.hr_only",
  supervisor: "settings.hr.fileSection.visibility.supervisor",
  director: "settings.hr.fileSection.visibility.director",
  sg: "audit.settings.mode.sg",
  hidden: "settings.hr.fileSection.visibility.hidden",
};

const CONFIDENTIALITY_LABELS: Record<HrPersonnelFileSection["confidentiality_level"], string> = {
  public: "settings.hr.fileSection.confValue.public",
  restricted: "settings.hr.fileSection.confValue.restricted",
  confidential: "settings.hr.fileSection.confValue.confidential",
};

const CONFIDENTIALITY_BADGE: Record<HrPersonnelFileSection["confidentiality_level"], string> = {
  public: "badge-success",
  restricted: "badge-warning",
  confidential: "badge-danger",
};

function PersonnelFileSectionModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrPersonnelFileSection> | null;
  onClose: () => void;
  onSave: (data: Partial<HrPersonnelFileSection>) => void;
}) {
  const isEdit = !!item?.id;
  const { t } = useI18n();
  const [form, setForm] = useState<Partial<HrPersonnelFileSection>>(
    item ?? {
      section_code: "",
      section_name: "",
      visibility: "hr_only",
      confidentiality_level: "restricted",
      is_editable_by_employee: false,
      is_mandatory: false,
      retention_months: 120,
      sort_order: 10,
      is_active: true,
    }
  );

  const set = <K extends keyof HrPersonnelFileSection>(key: K, val: HrPersonnelFileSection[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? t("settings.hr.fileSection.edit") : t("settings.hr.fileSection.new")}
          </h3>
          <button onClick={onClose} aria-label={t("settings.hr.fileSection.closeEditor")} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hr-personnel-file-sections-section-code" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.codeRequired")}</label>
              <input id="hr-personnel-file-sections-section-code"
                className="form-input text-sm uppercase"
                value={form.section_code ?? ""}
                onChange={(e) => set("section_code", e.target.value.toUpperCase())}
                placeholder={t("settings.hr.fileSection.codePlaceholder")}
                maxLength={30}
              />
            </div>
            <div>
              <label htmlFor="hr-personnel-file-sections-section-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.nameRequired")}</label>
              <input id="hr-personnel-file-sections-section-name"
                className="form-input text-sm"
                value={form.section_name ?? ""}
                onChange={(e) => set("section_name", e.target.value)}
                placeholder={t("settings.hr.fileSection.namePlaceholder")}
                maxLength={100}
              />
            </div>
          </div>

          <div>
            <label htmlFor="hr-personnel-file-sections-visibility" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.visibilityLabel")}</label>
            <select id="hr-personnel-file-sections-visibility"
              className="form-input text-sm"
              value={form.visibility ?? "hr_only"}
              onChange={(e) => set("visibility", e.target.value as HrPersonnelFileSection["visibility"])}
            >
              <option value="employee">{t("settings.hr.fileSection.visibility.employee")}</option>
              <option value="hr_only">{t("settings.hr.fileSection.visibility.hr_only")}</option>
              <option value="supervisor">{t("settings.hr.fileSection.visibility.supervisor")}</option>
              <option value="director">{t("settings.hr.fileSection.visibility.director")}</option>
              <option value="sg">{t("audit.settings.mode.sg")}</option>
              <option value="hidden">{t("settings.hr.fileSection.visibility.hidden")}</option>
            </select>
          </div>

          <div>
            <label htmlFor="hr-personnel-file-sections-confidentiality-level" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.confidentialityLevel")}</label>
            <select id="hr-personnel-file-sections-confidentiality-level"
              className="form-input text-sm"
              value={form.confidentiality_level ?? "restricted"}
              onChange={(e) => set("confidentiality_level", e.target.value as HrPersonnelFileSection["confidentiality_level"])}
            >
              <option value="public">{t("settings.hr.fileSection.confValue.public")}</option>
              <option value="restricted">{t("settings.hr.fileSection.confValue.restricted")}</option>
              <option value="confidential">{t("settings.hr.fileSection.confValue.confidential")}</option>
            </select>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">{t("settings.hr.fileSection.editableByEmployee")}</p>
              <p className="text-xs text-neutral-500">{t("settings.hr.fileSection.editableHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => set("is_editable_by_employee", !form.is_editable_by_employee)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                form.is_editable_by_employee ? "bg-primary" : "bg-neutral-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  form.is_editable_by_employee ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">{t("settings.hr.matrix.mandatory")}</p>
              <p className="text-xs text-neutral-500">{t("settings.hr.fileSection.mandatoryHint")}</p>
            </div>
            <button
              type="button"
              onClick={() => set("is_mandatory", !form.is_mandatory)}
              className={cn(
                "relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors",
                form.is_mandatory ? "bg-primary" : "bg-neutral-300"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform",
                  form.is_mandatory ? "translate-x-4" : "translate-x-0"
                )}
              />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="hr-personnel-file-sections-retention-months" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.retentionMonths")}</label>
              <input id="hr-personnel-file-sections-retention-months"
                type="number"
                className="form-input text-sm"
                min={1}
                max={1200}
                value={form.retention_months ?? 120}
                onChange={(e) => set("retention_months", parseInt(e.target.value) || 120)}
              />
            </div>
            <div>
              <label htmlFor="hr-personnel-file-sections-sort-order" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.fileSection.sortOrder")}</label>
              <input id="hr-personnel-file-sections-sort-order"
                type="number"
                className="form-input text-sm"
                min={1}
                value={form.sort_order ?? 10}
                onChange={(e) => set("sort_order", parseInt(e.target.value) || 10)}
              />
            </div>
          </div>

          <div>
            <label htmlFor="hr-personnel-file-sections-status" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.status")}</label>
            <select id="hr-personnel-file-sections-status"
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
            disabled={!form.section_code || !form.section_name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? t("settings.hr.common.saveChanges") : t("settings.hr.fileSection.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PersonnelFileSectionsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const [modal, setModal] = useState<Partial<HrPersonnelFileSection> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "personnel-file-sections"],
    queryFn: () =>
      hrSettingsApi.listPersonnelFileSections().then((r) => {
        const items = (r.data as any).data as HrPersonnelFileSection[];
        return [...items].sort((a, b) => a.sort_order - b.sort_order);
      }),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrPersonnelFileSection>) =>
      form.id
        ? hrSettingsApi.updatePersonnelFileSection(form.id, form).then((r) => r.data)
        : hrSettingsApi.createPersonnelFileSection(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "personnel-file-sections"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deletePersonnelFileSection(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", t("settings.hr.fileSection.deleted"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "personnel-file-sections"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.cannotDelete")),
  });

  const reorderMutation = useMutation({
    mutationFn: (items: { id: number; sort_order: number }[]) =>
      hrSettingsApi.reorderPersonnelFileSections(items).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-settings", "personnel-file-sections"] });
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.fileSection.reorderFailed")),
  });

  const items = data ?? [];

  function moveItem(index: number, direction: "up" | "down") {
    const newItems = [...items];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newItems.length) return;
    [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
    const reorderPayload = newItems.map((item, i) => ({ id: item.id, sort_order: (i + 1) * 10 }));
    reorderMutation.mutate(reorderPayload);
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <PersonnelFileSectionModal
          item={modal}
          onClose={() => setModal(undefined)}
          onSave={(form) => saveMutation.mutate(form)}
        />
      )}
      <HrSettingsHeader
        title={t("settings.hr.home.personnelFileSections.title")}
        subtitle={t("settings.hr.home.personnelFileSections.description")}
        actions={
          <button type="button" onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("settings.hr.fileSection.newSection")}
        </button>
        }
      />


      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {t(items.length === 1 ? "settings.hr.fileSection.countOne" : "settings.hr.fileSection.countMany", { count: items.length })}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="folder_shared" title={t("settings.hr.fileSection.emptyTitle")} description={t("settings.hr.common.emptyDescription")} />
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-20">{t("settings.hr.fileSection.order")}</th>
                <th>{t("settings.hr.common.code")}</th>
                <th>{t("settings.hr.fileSection.name")}</th>
                <th>{t("settings.hr.fileSection.visibilityLabel")}</th>
                <th>{t("settings.hr.fileSection.confidentiality")}</th>
                <th>{t("settings.hr.matrix.mandatory")}</th>
                <th>{t("settings.hr.common.status")}</th>
                <th className="w-32">{t("settings.hr.common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.id}>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-neutral-500 font-mono w-6">{item.sort_order}</span>
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={() => moveItem(index, "up")}
                          disabled={index === 0 || reorderMutation.isPending}
                          className="p-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                          title={t("settings.hr.fileSection.moveUp")}
                        >
                          <span className="material-symbols-outlined text-[14px]">arrow_upward</span>
                        </button>
                        <button
                          onClick={() => moveItem(index, "down")}
                          disabled={index === items.length - 1 || reorderMutation.isPending}
                          className="p-0.5 rounded hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 disabled:opacity-30"
                          title={t("settings.hr.fileSection.moveDown")}
                        >
                          <span className="material-symbols-outlined text-[14px]">arrow_downward</span>
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="font-mono text-xs bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded">
                      {item.section_code}
                    </span>
                  </td>
                  <td>
                    <p className="font-medium text-sm text-neutral-900">{item.section_name}</p>
                    <p className="text-xs text-neutral-500">{t("settings.hr.fileSection.retention", { count: item.retention_months })}</p>
                  </td>
                  <td>
                    <span className="text-sm text-neutral-700">{VISIBILITY_LABELS[item.visibility] ? t(VISIBILITY_LABELS[item.visibility]) : item.visibility}</span>
                  </td>
                  <td>
                    <span className={cn("badge", CONFIDENTIALITY_BADGE[item.confidentiality_level])}>
                      {CONFIDENTIALITY_LABELS[item.confidentiality_level] ? t(CONFIDENTIALITY_LABELS[item.confidentiality_level]) : item.confidentiality_level}
                    </span>
                  </td>
                  <td>
                    {item.is_mandatory ? (
                      <span className="badge badge-warning">{t("settings.hr.matrix.required")}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">{t("settings.hr.fileSection.optional")}</span>
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
