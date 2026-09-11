"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";

export type MitigationDraft = {
  description: string;
  due_date: string;
  treatment_type: string;
  file: File | null;
};

export const EMPTY_MITIGATION: MitigationDraft = {
  description: "",
  due_date: "",
  treatment_type: "mitigate",
  file: null,
};

export function ApplyMitigationFields({
  value,
  onChange,
  idPrefix = "risk-mitigation",
  required = false,
}: {
  value: MitigationDraft;
  onChange: (next: MitigationDraft) => void;
  idPrefix?: string;
  required?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label htmlFor={`${idPrefix}-description`} className="block text-xs font-semibold text-neutral-700 sm:col-span-2">
        {t("risk.mitigation.description")}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
        <textarea
          id={`${idPrefix}-description`}
          className="form-input mt-1 w-full h-20 resize-none"
          value={value.description}
          onChange={(e) => onChange({ ...value, description: e.target.value })}
          required={required}
        />
      </label>
      <label htmlFor={`${idPrefix}-type`} className="block text-xs font-semibold text-neutral-700">
        {t("risk.mitigation.treatment")}
        <select
          id={`${idPrefix}-type`}
          className="form-input mt-1 w-full"
          value={value.treatment_type}
          onChange={(e) => onChange({ ...value, treatment_type: e.target.value })}
        >
          <option value="mitigate">{t("risk.mitigation.type.mitigate")}</option>
          <option value="accept">{t("risk.mitigation.type.accept")}</option>
          <option value="transfer">{t("risk.mitigation.type.transfer")}</option>
          <option value="avoid">{t("risk.mitigation.type.avoid")}</option>
        </select>
      </label>
      <label htmlFor={`${idPrefix}-due`} className="block text-xs font-semibold text-neutral-700">
        {t("risk.mitigation.dueDate")}
        <input
          id={`${idPrefix}-due`}
          type="date"
          className="form-input mt-1 w-full"
          value={value.due_date}
          onChange={(e) => onChange({ ...value, due_date: e.target.value })}
        />
      </label>
      <label htmlFor={`${idPrefix}-file`} className="block text-xs font-semibold text-neutral-700 sm:col-span-2">
        {t("risk.mitigation.file")}
        <input
          id={`${idPrefix}-file`}
          type="file"
          className="form-input mt-1 w-full"
          onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
        />
        <span className="mt-1 block text-[11px] text-neutral-500">{t("risk.mitigation.fileHint")}</span>
      </label>
    </div>
  );
}
