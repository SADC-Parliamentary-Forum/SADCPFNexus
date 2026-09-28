"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/**
 * Generic searchable combobox. Extracted from the proven pattern in
 * web/components/assets/AssetAssigneePicker.tsx (debounced search, click-away
 * close, ARIA combobox/listbox) so every module can share one implementation
 * instead of hand-rolling fetch/debounce/dropdown logic per picker.
 */
export interface NexusPickerProps<T> {
  id: string;
  label: string;
  value: T | null;
  onSelect: (option: T | null) => void;
  fetchOptions: (query: string) => Promise<T[]>;
  getId: (option: T) => string | number;
  getLabel: (option: T) => string;
  getSecondaryLabel?: (option: T) => string | null | undefined;
  renderOption?: (option: T) => React.ReactNode;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  /** Clear button label shown under a selected value (omit to hide when required). */
  clearLabel?: string;
  /** Max options rendered from a fetch result (defaults to 8, matching AssetAssigneePicker). */
  maxOptions?: number;
}

export function NexusPicker<T>({
  id,
  label,
  value,
  onSelect,
  fetchOptions,
  getId,
  getLabel,
  getSecondaryLabel,
  renderOption,
  disabled,
  required,
  hint,
  placeholder,
  clearLabel,
  maxOptions = 8,
}: NexusPickerProps<T>) {
  const { t } = useI18n();
  const selectedLabel = value ? getLabel(value) : "";
  const [query, setQuery] = useState(selectedLabel);
  const [options, setOptions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ? getLabel(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  useEffect(() => {
    if (disabled) return;
    const browsingSelected = Boolean(value) && query === selectedLabel;
    const search = browsingSelected ? "" : query.trim();
    if (!open && browsingSelected) return;
    if (!open && search === "") return;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptions(search);
        setOptions(results);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, search ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, value, disabled, open, selectedLabel]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative space-y-2">
      <label htmlFor={id} className="block text-xs font-medium text-neutral-700 mb-1">
        {label}
        {required ? <span className="text-red-500 ml-0.5">*</span> : null}
      </label>
      <input
        id={id}
        type="search"
        className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 focus:border-primary focus:ring-1 focus:ring-primary outline-none disabled:opacity-50"
        placeholder={placeholder ?? t("common.search")}
        value={query}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-autocomplete="list"
        onChange={(e) => {
          setQuery(e.target.value);
          if (value) onSelect(null);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {open ? (
        <div
          id={`${id}-options`}
          role="listbox"
          className="absolute z-50 mt-1 w-full rounded-xl border border-neutral-200 bg-white shadow-lg overflow-hidden max-h-72 overflow-y-auto"
        >
          {loading ? (
            <p className="px-3 py-2 text-xs text-neutral-500">{t("common.loading")}</p>
          ) : options.length === 0 ? (
            <p className="px-3 py-2 text-xs text-neutral-500">{t("common.noResults")}</p>
          ) : (
            options.slice(0, maxOptions).map((opt) => {
              const optLabel = getLabel(opt);
              const secondary = getSecondaryLabel?.(opt);
              return (
                <button
                  key={getId(opt)}
                  type="button"
                  role="option"
                  className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-2"
                  onMouseDown={() => {
                    onSelect(opt);
                    setQuery(optLabel);
                    setOpen(false);
                  }}
                >
                  {renderOption ? (
                    renderOption(opt)
                  ) : (
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{optLabel}</p>
                      {secondary ? <p className="text-xs text-neutral-500 truncate">{secondary}</p> : null}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      ) : null}
      {!required && value && clearLabel ? (
        <button type="button" className="text-xs text-primary font-medium" onClick={() => { onSelect(null); setQuery(""); }} disabled={disabled}>
          {clearLabel}
        </button>
      ) : null}
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
