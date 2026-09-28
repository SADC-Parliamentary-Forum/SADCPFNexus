"use client";

import { tenantUsersApi, type TenantUserOption } from "@/lib/api";
import { assigneeDepartmentName, formatAssigneeLabel } from "@/lib/asset-assignee";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { NexusPicker } from "@/components/ui/NexusPicker";

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
  const department = assigneeDepartmentName(value);

  return (
    <div className="space-y-2">
      <NexusPicker<TenantUserOption>
        id={id}
        label={label}
        value={value}
        onSelect={onSelect}
        disabled={disabled}
        required={required}
        placeholder={t("assets.searchAssignee")}
        fetchOptions={async (search) => {
          const r = await tenantUsersApi.list({ search: search || undefined });
          return r.data.data ?? [];
        }}
        getId={(u) => u.id}
        getLabel={(u) => formatAssigneeLabel(u)}
        renderOption={(u) => {
          const dept = assigneeDepartmentName(u);
          return (
            <>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-bold flex-shrink-0">
                {(u.name || "?").slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{u.name}</p>
                <p className="text-xs text-neutral-500 truncate">
                  {[u.email, dept].filter(Boolean).join(" · ") || t("assets.notAssigned")}
                </p>
              </div>
            </>
          );
        }}
      />
      {value ? (
        <div className="rounded-lg border border-neutral-100 bg-neutral-50 px-3 py-2 text-xs text-neutral-700">
          <p className="font-medium text-neutral-900">{value.name}</p>
          {value.email ? <p>{t("assets.assigneeEmail")}: {value.email}</p> : null}
          {department ? <p>{t("assets.assigneeDepartment")}: {department}</p> : null}
          {!required ? (
            <button
              type="button"
              className="mt-1 text-primary font-medium"
              onClick={() => onSelect(null)}
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
