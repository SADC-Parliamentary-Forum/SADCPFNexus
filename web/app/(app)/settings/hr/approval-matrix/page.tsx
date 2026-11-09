"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { hrSettingsApi, type HrApprovalMatrix } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { HrSettingsHeader } from "@/components/hr/HrSettingsHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const MODULES = [
  { value: "", label: "settings.hr.matrix.allModules" },
  { value: "travel", label: "nav.travel" },
  { value: "leave", label: "nav.leave" },
  { value: "imprest", label: "nav.imprest" },
  { value: "finance", label: "nav.finance" },
  { value: "procurement", label: "nav.procurement" },
  { value: "hr", label: "nav.hr" },
  { value: "governance", label: "settings.hr.matrix.governance" },
];

const MODULE_COLORS: Record<string, string> = {
  travel: "bg-blue-50 text-blue-700",
  leave: "bg-teal-50 text-teal-700",
  imprest: "bg-amber-50 text-amber-700",
  finance: "bg-green-50 text-green-700",
  procurement: "bg-primary/10 text-primary",
  hr: "bg-pink-50 text-pink-700",
  governance: "bg-orange-50 text-orange-700",
};

function ApprovalMatrixModal({
  item,
  onClose,
  onSave,
}: {
  item: Partial<HrApprovalMatrix> | null;
  onClose: () => void;
  onSave: (data: Partial<HrApprovalMatrix>) => void;
}) {
  const isEdit = !!item?.id;
  const { t } = useI18n();
  const [form, setForm] = useState<Partial<HrApprovalMatrix>>(
    item ?? {
      module: "hr",
      action_name: "",
      step_number: 1,
      role_id: null,
      approver_user_id: null,
      is_mandatory: true,
      notes: "",
      is_active: true,
    }
  );
  const [roleNameInput, setRoleNameInput] = useState(item?.role?.name ?? "");

  const set = <K extends keyof HrApprovalMatrix>(key: K, val: HrApprovalMatrix[K]) =>
    setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-neutral-900">
            {isEdit ? t("settings.hr.matrix.edit") : t("settings.hr.matrix.new")}
          </h3>
          <button onClick={onClose} aria-label={t("settings.hr.matrix.closeEditor")} className="text-neutral-400 hover:text-neutral-700">
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label htmlFor="settings-hr-approval-matrix-module" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.matrix.moduleRequired")}</label>
            <select id="settings-hr-approval-matrix-module"
              className="form-input text-sm"
              value={form.module ?? "hr"}
              onChange={(e) => set("module", e.target.value)}
            >
              {MODULES.filter((m) => m.value !== "").map((m) => (
                <option key={m.value} value={m.value}>{t(m.label)}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="settings-hr-approval-matrix-action-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.matrix.actionRequired")}</label>
            <input id="settings-hr-approval-matrix-action-name"
              className="form-input text-sm"
              value={form.action_name ?? ""}
              onChange={(e) => set("action_name", e.target.value)}
              placeholder={t("settings.hr.matrix.actionPlaceholder")}
            />
          </div>

          <div>
            <label htmlFor="settings-hr-approval-matrix-step-number" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.matrix.stepNumber")}</label>
            <input id="settings-hr-approval-matrix-step-number"
              type="number"
              className="form-input text-sm"
              min={1}
              max={10}
              value={form.step_number ?? 1}
              onChange={(e) => set("step_number", parseInt(e.target.value) || 1)}
            />
            <p className="text-xs text-neutral-400 mt-1">{t("settings.hr.matrix.stepHint")}</p>
          </div>

          <div>
            <label htmlFor="settings-hr-approval-matrix-approver-role-name" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.matrix.roleName")}</label>
            <input id="settings-hr-approval-matrix-approver-role-name"
              className="form-input text-sm"
              value={roleNameInput}
              onChange={(e) => {
                setRoleNameInput(e.target.value);
              }}
              placeholder={t("settings.hr.matrix.rolePlaceholder")}
            />
            <p className="text-xs text-neutral-400 mt-1">{t("settings.hr.matrix.roleHint")}</p>
          </div>

          <div>
            <label htmlFor="settings-hr-approval-matrix-notes" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.notes")}</label>
            <textarea id="settings-hr-approval-matrix-notes"
              className="form-input text-sm resize-none"
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder={t("settings.hr.matrix.notesPlaceholder")}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg bg-neutral-50 border border-neutral-200 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-neutral-800">{t("settings.hr.matrix.mandatory")}</p>
              <p className="text-xs text-neutral-500">{t("settings.hr.matrix.mandatoryHint")}</p>
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

          <div>
            <label htmlFor="settings-hr-approval-matrix-status" className="block text-xs font-medium text-neutral-700 mb-1">{t("settings.hr.common.status")}</label>
            <select id="settings-hr-approval-matrix-status"
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
            disabled={!form.module || !form.action_name}
            className="btn-primary flex-1 text-sm disabled:opacity-50"
          >
            {isEdit ? t("settings.hr.common.saveChanges") : t("settings.hr.matrix.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ApprovalMatrixPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useI18n();
  const [modal, setModal] = useState<Partial<HrApprovalMatrix> | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [moduleFilter, setModuleFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["hr-settings", "approval-matrix", moduleFilter],
    queryFn: () =>
      hrSettingsApi.listApprovalMatrix(moduleFilter ? { module: moduleFilter } : undefined)
        .then((r) => (r.data as any).data as HrApprovalMatrix[]),
  });

  const saveMutation = useMutation({
    mutationFn: (form: Partial<HrApprovalMatrix>) =>
      form.id
        ? hrSettingsApi.updateApprovalMatrixEntry(form.id, form).then((r) => r.data)
        : hrSettingsApi.createApprovalMatrixEntry(form).then((r) => r.data),
    onSuccess: (res: any) => {
      toast("success", res.message ?? t("settings.hr.common.saved"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "approval-matrix"] });
      setModal(undefined);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.saveFailed")),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hrSettingsApi.deleteApprovalMatrixEntry(id).then((r) => r.data),
    onSuccess: () => {
      toast("success", t("settings.hr.matrix.deleted"));
      qc.invalidateQueries({ queryKey: ["hr-settings", "approval-matrix"] });
      setDeleting(null);
    },
    onError: (e: any) => toast("error", e?.response?.data?.message ?? t("settings.hr.common.cannotDelete")),
  });

  const items = data ?? [];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
      {modal !== undefined && (
        <ApprovalMatrixModal
          item={modal}
          onClose={() => setModal(undefined)}
          onSave={(form) => saveMutation.mutate(form)}
        />
      )}
      <HrSettingsHeader
        title={t("settings.hr.home.approvalMatrix.title")}
        subtitle={t("settings.hr.home.approvalMatrix.description")}
        actions={
          <button type="button" onClick={() => setModal(null)} className="btn-primary flex items-center gap-2 shrink-0">
          <span className="material-symbols-outlined text-[18px]">add</span>
          {t("settings.hr.matrix.newStep")}
        </button>
        }
      />


      {/* Module filter */}
      <div className="flex gap-2 flex-wrap">
        {MODULES.map((m) => (
          <button
            key={m.value}
            onClick={() => setModuleFilter(m.value)}
            className={cn(
              "filter-tab",
              moduleFilter === m.value && "active"
            )}
          >
            {t(m.label)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
          <p className="text-sm font-medium text-neutral-700">
            {t(items.length === 1 ? "settings.hr.matrix.countOne" : "settings.hr.matrix.countMany", { count: items.length })}
            {moduleFilter && ` · ${t(MODULES.find((m) => m.value === moduleFilter)?.label ?? moduleFilter)}`}
          </p>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-neutral-400 text-sm">
            <span className="material-symbols-outlined animate-spin text-[24px]">progress_activity</span>
          </div>
        ) : items.length === 0 ? (
          <EmptyState icon="account_tree" title={t("settings.hr.matrix.emptyTitle")} description={t("settings.hr.common.emptyDescription")} />
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>{t("settings.hr.matrix.module")}</th>
                <th>{t("settings.hr.matrix.action")}</th>
                <th>{t("settings.hr.matrix.step")}</th>
                <th>{t("settings.hr.matrix.roleApprover")}</th>
                <th>{t("settings.hr.matrix.mandatory")}</th>
                <th>{t("settings.hr.common.status")}</th>
                <th className="w-24">{t("settings.hr.common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className={cn(
                      "text-xs font-medium px-2 py-0.5 rounded-full capitalize",
                      MODULE_COLORS[item.module] ?? "bg-neutral-100 text-neutral-600"
                    )}>
                      {(() => {
                        const known = MODULES.find((m) => m.value === item.module && m.value !== "");
                        return known ? t(known.label) : item.module;
                      })()}
                    </span>
                  </td>
                  <td>
                    <p className="font-medium text-sm text-neutral-900">{item.action_name}</p>
                    {item.notes && (
                      <p className="text-xs text-neutral-500 truncate max-w-xs">{item.notes}</p>
                    )}
                  </td>
                  <td>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                      {item.step_number}
                    </span>
                  </td>
                  <td>
                    {item.role ? (
                      <span className="text-sm text-neutral-700">{item.role.name}</span>
                    ) : item.approver_user ? (
                      <span className="text-sm text-neutral-700">{item.approver_user.name}</span>
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td>
                    {item.is_mandatory ? (
                      <span className="badge badge-warning">{t("settings.hr.matrix.required")}</span>
                    ) : (
                      <span className="badge badge-muted">{t("settings.hr.matrix.optional")}</span>
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
