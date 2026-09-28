"use client";

import { tenantUsersApi, type TenantUserOption } from "@/lib/api";
import { assigneeDepartmentName, formatAssigneeLabel } from "@/lib/asset-assignee";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { NexusPicker } from "@/components/ui/NexusPicker";

/**
 * App-wide employee picker preset over NexusPicker. Sourced from
 * `tenantUsersApi` (the `users` table) — NOT the People & Authority
 * directory, which is frequently empty until manually populated or
 * M365-synced. A picker used across the whole app must not default to a
 * data source that's commonly empty out of the box.
 */
export function EmployeePicker({
  id,
  label,
  value,
  onSelect,
  disabled,
  required,
  hint,
  placeholder,
}: {
  id: string;
  label: string;
  value: TenantUserOption | null;
  onSelect: (user: TenantUserOption | null) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();

  return (
    <NexusPicker<TenantUserOption>
      id={id}
      label={label}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      required={required}
      hint={hint}
      placeholder={placeholder ?? t("assets.searchAssignee")}
      clearLabel={t("assets.notAssigned")}
      fetchOptions={async (search) => {
        const r = await tenantUsersApi.list({ search: search || undefined });
        return r.data.data ?? [];
      }}
      getId={(u) => u.id}
      getLabel={(u) => formatAssigneeLabel(u)}
      getSecondaryLabel={(u) => [u.email, assigneeDepartmentName(u)].filter(Boolean).join(" · ")}
    />
  );
}
