"use client";

import { useEffect, useRef, useState } from "react";
import { tenantUsersApi, type TenantUserOption } from "@/lib/api";
import { assigneeDepartmentName, formatAssigneeLabel } from "@/lib/asset-assignee";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export function AssetAssigneePicker({
  id,
  label,
  value,
  onSelect,
  disabled,
  required,
  hint,
}: {
  id: string;
  label: string;
  value: TenantUserOption | null;
  onSelect: (user: TenantUserOption | null) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState(value ? formatAssigneeLabel(value) : "");
  const [options, setOptions] = useState<TenantUserOption[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value ? formatAssigneeLabel(value) : "");
  }, [value]);

  useEffect(() => {
    if (disabled) {
      return;
    }
    if (!query.trim() || (value && query === formatAssigneeLabel(value))) {
      setOptions([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await tenantUsersApi.list({ search: query });
        setOptions(r.data.data ?? []);
        setOpen(true);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, value, disabled]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const department = assigneeDepartmentName(value);

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
        placeholder={t("assets.searchAssignee")}
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
        onFocus={() => {
          if (options.length > 0) setOpen(true);
        }}
      />
      {open && (query.trim().length > 0) && (
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
            options.slice(0, 8).map((u) => {
              const dept = assigneeDepartmentName(u);
              return (
                <button
                  key={u.id}
                  type="button"
                  role="option"
                  className="w-full px-3 py-2.5 text-left hover:bg-neutral-50 flex items-center gap-2"
                  onMouseDown={() => {
                    onSelect(u);
                    setQuery(formatAssigneeLabel(u));
                    setOpen(false);
                  }}
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                    {(u.name || "?").slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-neutral-900 truncate">{u.name}</p>
                    <p className="text-xs text-neutral-500 truncate">
                      {[u.email, dept].filter(Boolean).join(" · ") || t("assets.notAssigned")}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      )}
      {value ? (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          <p className="font-medium text-neutral-900">{value.name}</p>
          {value.email ? <p>{t("assets.assigneeEmail")}: {value.email}</p> : null}
          {department ? <p>{t("assets.assigneeDepartment")}: {department}</p> : null}
          {!required ? (
            <button
              type="button"
              className="mt-1 text-primary font-medium"
              onClick={() => {
                onSelect(null);
                setQuery("");
              }}
              disabled={disabled}
            >
              {t("assets.notAssigned")}
            </button>
          ) : null}
        </div>
      ) : null}
      {hint ? <p className="text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
