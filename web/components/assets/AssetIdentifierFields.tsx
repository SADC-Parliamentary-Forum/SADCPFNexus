"use client";

import { useI18n } from "@/lib/i18n/LocaleProvider";

export type AssetIdentifiers = {
  serial_number: string;
  manufacturer: string;
  model: string;
};

export const EMPTY_IDENTIFIERS: AssetIdentifiers = { serial_number: "", manufacturer: "", model: "" };

/** True when an API error is the duplicate-serial validation failure. */
export function isSerialConflict(err: unknown): boolean {
  const errors = (err as { response?: { data?: { errors?: Record<string, unknown> } } })?.response?.data?.errors;
  return Boolean(errors && "serial_number" in errors);
}

/**
 * Serial number, make and model inputs shared by the asset add and edit forms.
 * The duplicate-serial override only appears after the server reports a clash.
 */
export function AssetIdentifierFields({
  idPrefix,
  value,
  onChange,
  disabled,
  serialConflict,
  allowDuplicate,
  onAllowDuplicateChange,
  inputClassName = "form-input",
  labelClassName = "block text-xs font-medium text-neutral-700 mb-1",
  showReprintNote,
}: {
  idPrefix: string;
  value: AssetIdentifiers;
  onChange: (next: AssetIdentifiers) => void;
  disabled?: boolean;
  serialConflict?: boolean;
  allowDuplicate?: boolean;
  onAllowDuplicateChange?: (allow: boolean) => void;
  inputClassName?: string;
  labelClassName?: string;
  showReprintNote?: boolean;
}) {
  const { t } = useI18n();
  const set = (field: keyof AssetIdentifiers) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...value, [field]: e.target.value });

  return (
    <div className="space-y-3" data-testid={`${idPrefix}-identifiers`}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-serial`} className={labelClassName}>{t("assets.serial.serialNumber")}</label>
          <input
            id={`${idPrefix}-serial`}
            type="text"
            maxLength={128}
            autoComplete="off"
            spellCheck={false}
            value={value.serial_number}
            onChange={set("serial_number")}
            className={`${inputClassName} font-mono`}
            disabled={disabled}
            aria-describedby={`${idPrefix}-serial-hint`}
            aria-invalid={serialConflict || undefined}
            data-testid={`${idPrefix}-serial`}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-manufacturer`} className={labelClassName}>{t("assets.serial.manufacturer")}</label>
          <input
            id={`${idPrefix}-manufacturer`}
            type="text"
            maxLength={128}
            value={value.manufacturer}
            onChange={set("manufacturer")}
            className={inputClassName}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${idPrefix}-model`} className={labelClassName}>{t("assets.serial.model")}</label>
          <input
            id={`${idPrefix}-model`}
            type="text"
            maxLength={128}
            value={value.model}
            onChange={set("model")}
            className={inputClassName}
            disabled={disabled}
          />
        </div>
      </div>
      <p id={`${idPrefix}-serial-hint`} className="text-xs text-neutral-500">
        {t("assets.serial.hint")}
        {showReprintNote ? ` ${t("assets.serial.reprintNote")}` : null}
      </p>
      {serialConflict && onAllowDuplicateChange ? (
        <label htmlFor={`${idPrefix}-allow-duplicate`} className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <input
            id={`${idPrefix}-allow-duplicate`}
            type="checkbox"
            checked={Boolean(allowDuplicate)}
            onChange={(e) => onAllowDuplicateChange(e.target.checked)}
            disabled={disabled}
            data-testid={`${idPrefix}-allow-duplicate`}
          />
          <span>{t("assets.serial.allowDuplicate")}</span>
        </label>
      ) : null}
    </div>
  );
}
