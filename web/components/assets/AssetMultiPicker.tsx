"use client";

import { useEffect, useMemo, useState } from "react";
import { assetsApi, type Asset } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { SearchField } from "@/components/ui/SearchField";

const PAGE_SIZE = 100;

/**
 * Searchable checklist of register assets. Searches on the server so assets
 * beyond the first page can be found, and keeps selections (shown at the top)
 * when a later search no longer returns them.
 */
export function AssetMultiPicker({
  selected,
  onChange,
  status,
  reloadKey,
  testId,
  searchTestId,
  optionTestIdPrefix,
}: {
  selected: Map<number, Asset>;
  onChange: (next: Map<number, Asset>) => void;
  status?: string;
  /** Change to refetch (e.g. after the selected assets were saved). */
  reloadKey?: number;
  testId?: string;
  searchTestId?: string;
  /** Each option gets data-testid={`${prefix}${asset.id}`}. */
  optionTestIdPrefix: string;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const term = search.trim();
    const timer = setTimeout(() => {
      setLoading(true);
      assetsApi
        .list({ search: term || undefined, status, per_page: PAGE_SIZE })
        .then((res) => {
          if (cancelled) return;
          const rows = res.data.data ?? [];
          setAssets(rows);
          setTotal(res.data.total ?? rows.length);
          setFailed(false);
        })
        .catch(() => {
          if (!cancelled) setFailed(true);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [search, status, reloadKey]);

  const options = useMemo(() => {
    const shown = new Set(assets.map((a) => a.id));
    const pinned = [...selected.values()].filter((a) => !shown.has(a.id));
    return [...pinned, ...assets];
  }, [assets, selected]);

  function toggle(asset: Asset, checked: boolean) {
    const next = new Map(selected);
    if (checked) next.set(asset.id, asset);
    else next.delete(asset.id);
    onChange(next);
  }

  function selectAllShown() {
    const next = new Map(selected);
    for (const a of assets) next.set(a.id, a);
    onChange(next);
  }

  return (
    <div className="space-y-2" data-testid={testId}>
      <SearchField value={search} onChange={setSearch} placeholder={t("assets.picker.search")} testId={searchTestId} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
        <span data-testid={testId ? `${testId}-count` : undefined}>{t("assets.picker.selectedCount", { count: selected.size })}</span>
        <span className="flex items-center gap-3">
          {total > assets.length ? <span>{t("assets.picker.moreMatches", { shown: assets.length, total })}</span> : null}
          {assets.length > 0 ? (
            <button type="button" className="font-medium text-primary" onClick={selectAllShown}>
              {t("assets.picker.selectShown")}
            </button>
          ) : null}
          {selected.size > 0 ? (
            <button type="button" className="font-medium text-primary" onClick={() => onChange(new Map())}>
              {t("assets.picker.clear")}
            </button>
          ) : null}
        </span>
      </div>
      <div className="max-h-64 space-y-1 overflow-auto rounded-lg border border-neutral-100 p-2" aria-busy={loading}>
        {failed ? <p className="py-2 text-sm text-red-700">{t("assets.loadFailed")}</p> : null}
        {!failed && options.length === 0 && !loading ? (
          <p className="py-2 text-sm text-neutral-500">{t("common.noResults")}</p>
        ) : null}
        {options.map((asset) => (
          <label
            key={asset.id}
            className="flex items-center gap-2 rounded px-1 py-0.5 text-sm hover:bg-neutral-50"
            data-testid={`${optionTestIdPrefix}${asset.id}`}
          >
            <input type="checkbox" checked={selected.has(asset.id)} onChange={(e) => toggle(asset, e.target.checked)} />
            <span className="font-mono text-xs">{asset.tag_number || asset.asset_code}</span>
            <span className="truncate">{asset.name}</span>
            {asset.assigned_user?.name ? <span className="truncate text-xs text-neutral-400">{asset.assigned_user.name}</span> : null}
          </label>
        ))}
      </div>
    </div>
  );
}
