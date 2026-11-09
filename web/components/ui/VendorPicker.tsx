"use client";

import { vendorsApi, type Vendor } from "@/lib/api";
import { NexusPicker } from "@/components/ui/NexusPicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

/**
 * App-wide vendor/supplier picker preset over NexusPicker. Sourced from
 * `vendorsApi` filtered to `status: "approved"` only — contracts (and other
 * consumers) should never let an unapproved, pending, or blacklisted vendor
 * be selectable.
 */
export function VendorPicker({
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
  value: Vendor | null;
  onSelect: (vendor: Vendor | null) => void;
  disabled?: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
}) {
  const { t } = useI18n();
  return (
    <NexusPicker<Vendor>
      id={id}
      label={label}
      value={value}
      onSelect={onSelect}
      disabled={disabled}
      required={required}
      hint={hint}
      placeholder={placeholder ?? t("ui.vendorPicker.placeholder")}
      fetchOptions={async (search) => {
        const r = await vendorsApi.list({ search: search || undefined, status: "approved", per_page: 20 });
        return r.data.data ?? [];
      }}
      getId={(v) => v.id}
      getLabel={(v) => v.name}
      getSecondaryLabel={(v) => v.registration_number}
    />
  );
}
