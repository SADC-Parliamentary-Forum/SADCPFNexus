"use client";

import { assetsApi, type Asset } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { NexusPicker } from "@/components/ui/NexusPicker";

export function assetPickerLabel(asset: Pick<Asset, "tag_number" | "asset_code" | "name">): string {
  return `${asset.tag_number || asset.asset_code} — ${asset.name}`;
}

/**
 * Type-ahead asset search over the register (name, tag, code or serial number).
 * Replaces long <select> lists, which only ever held the first page of assets.
 */
export function AssetPicker({
  id,
  label,
  value,
  onSelect,
  status,
  required,
  disabled,
  hint,
  dataTestId,
}: {
  id: string;
  label: string;
  value: Asset | null;
  onSelect: (asset: Asset | null) => void;
  /** Register status filter, e.g. "available" or "live". */
  status?: string;
  required?: boolean;
  disabled?: boolean;
  hint?: string;
  dataTestId?: string;
}) {
  const { t } = useI18n();

  return (
    <NexusPicker<Asset>
      id={id}
      label={label}
      value={value}
      onSelect={onSelect}
      required={required}
      disabled={disabled}
      hint={hint}
      placeholder={t("assets.picker.search")}
      dataTestId={dataTestId}
      maxOptions={10}
      fetchOptions={async (search) => {
        const r = await assetsApi.list({ search: search || undefined, status, per_page: 10 });
        return r.data.data ?? [];
      }}
      getId={(a) => a.id}
      getLabel={assetPickerLabel}
      renderOption={(a) => (
        <div className="min-w-0">
          <p className="truncate text-sm text-neutral-900">
            <span className="font-mono text-xs text-neutral-600">{a.tag_number || a.asset_code}</span> {a.name}
          </p>
          <p className="truncate text-xs text-neutral-500">
            {[a.status, a.assigned_user?.name, a.location?.name, a.serial_number].filter(Boolean).join(" · ")}
          </p>
        </div>
      )}
    />
  );
}
