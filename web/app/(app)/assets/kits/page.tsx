"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { assetsApi, type Asset, type AssetKit } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const ASSET_PAGE_SIZE = 100;

function SearchInput({
  value,
  onChange,
  placeholder,
  testId,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  testId: string;
}) {
  return (
    <div className="relative">
      <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-neutral-400">search</span>
      <input
        type="search"
        className="form-input pl-9"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        data-testid={testId}
      />
    </div>
  );
}

export default function AssetKitsPage() {
  const { t } = useI18n();
  const [kits, setKits] = useState<AssetKit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetTotal, setAssetTotal] = useState(0);
  const [assetSearch, setAssetSearch] = useState("");
  const [assetsLoading, setAssetsLoading] = useState(false);
  const [assetReload, setAssetReload] = useState(0);
  const [kitSearch, setKitSearch] = useState("");
  const [name, setName] = useState("");
  // Selected assets are kept by id so they stay selected (and visible) when a
  // later search no longer returns them.
  const [selected, setSelected] = useState<Map<number, Asset>>(new Map());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKits() {
    const kitRes = await assetsApi.kits();
    setKits(kitRes.data.data ?? []);
  }

  useEffect(() => {
    loadKits().catch(() => setError(t("assets.loadFailed")));
  }, [t]);

  // Search the register on the server so assets beyond the first page can be found.
  useEffect(() => {
    let cancelled = false;
    const term = assetSearch.trim();
    const timer = setTimeout(() => {
      setAssetsLoading(true);
      assetsApi
        .list({ search: term || undefined, per_page: ASSET_PAGE_SIZE })
        .then((res) => {
          if (cancelled) return;
          const rows = res.data.data ?? [];
          setAssets(rows);
          setAssetTotal(res.data.total ?? rows.length);
        })
        .catch(() => {
          if (!cancelled) setError(t("assets.loadFailed"));
        })
        .finally(() => {
          if (!cancelled) setAssetsLoading(false);
        });
    }, term ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [assetSearch, assetReload, t]);

  const assetOptions = useMemo(() => {
    const shown = new Set(assets.map((a) => a.id));
    const pinned = [...selected.values()].filter((a) => !shown.has(a.id));
    return [...pinned, ...assets];
  }, [assets, selected]);

  const filteredKits = useMemo(() => {
    const term = kitSearch.trim().toLowerCase();
    if (!term) return kits;
    return kits.filter((kit) =>
      [kit.name, ...(kit.items ?? []).flatMap((item) => [item.tag_number, item.name])]
        .some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [kits, kitSearch]);

  function toggle(asset: Asset, checked: boolean) {
    setSelected((cur) => {
      const next = new Map(cur);
      if (checked) next.set(asset.id, asset);
      else next.delete(asset.id);
      return next;
    });
  }

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await assetsApi.createKit({ name: name.trim(), asset_ids: [...selected.keys()] });
      setName("");
      setSelected(new Map());
      await loadKits();
      setAssetReload((n) => n + 1);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.assignFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.kits.title"
        subtitle="assets.kits.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.kits.title" }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <form onSubmit={create} className="card space-y-3 p-4" data-testid="kit-create-form">
        <label className="block text-sm">
          {t("assets.kits.name")}
          <input className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required data-testid="kit-name" />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
          <SearchInput
            value={assetSearch}
            onChange={setAssetSearch}
            placeholder={t("assets.kits.searchAssets")}
            testId="kit-asset-search"
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
            <span data-testid="kit-selected-count">{t("assets.kits.selectedCount", { count: selected.size })}</span>
            {assetTotal > assets.length ? (
              <span>{t("assets.kits.moreMatches", { shown: assets.length, total: assetTotal })}</span>
            ) : null}
          </div>
          <div className="max-h-64 overflow-auto space-y-1" aria-busy={assetsLoading}>
            {assetOptions.length === 0 && !assetsLoading ? (
              <p className="py-2 text-sm text-neutral-500">{t("common.noResults")}</p>
            ) : null}
            {assetOptions.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm" data-testid={`kit-asset-${asset.id}`}>
                <input
                  type="checkbox"
                  checked={selected.has(asset.id)}
                  onChange={(e) => toggle(asset, e.target.checked)}
                />
                <span className="font-mono text-xs">{asset.tag_number || asset.asset_code}</span>
                <span>{asset.name}</span>
                {asset.serial_number ? <span className="text-xs text-neutral-400">{asset.serial_number}</span> : null}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()} data-testid="kit-create">{t("assets.kits.create")}</button>
      </form>
      {kits.length === 0 ? (
        <EmptyState title="assets.kits.empty" />
      ) : (
        <div className="space-y-3">
          <SearchInput
            value={kitSearch}
            onChange={setKitSearch}
            placeholder={t("assets.kits.searchKits")}
            testId="kit-search"
          />
          {filteredKits.length === 0 ? (
            <p className="text-sm text-neutral-500">{t("common.noResults")}</p>
          ) : null}
          {filteredKits.map((kit) => (
            <article key={kit.id} className="card p-4" data-testid={`kit-${kit.id}`}>
              <h2 className="font-semibold">{kit.name}</h2>
              <ul className="mt-2 text-sm text-neutral-700">
                {(kit.items ?? []).map((item) => (
                  <li key={item.id} className="font-mono text-xs">{item.tag_number} — {item.name}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
