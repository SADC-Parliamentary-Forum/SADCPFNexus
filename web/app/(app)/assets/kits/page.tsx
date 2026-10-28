"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { assetsApi, type Asset, type AssetKit } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { SearchField } from "@/components/ui/SearchField";
import { AssetMultiPicker } from "@/components/assets/AssetMultiPicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetKitsPage() {
  const { t } = useI18n();
  const [kits, setKits] = useState<AssetKit[]>([]);
  const [kitSearch, setKitSearch] = useState("");
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Map<number, Asset>>(new Map());
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadKits() {
    const kitRes = await assetsApi.kits();
    setKits(kitRes.data.data ?? []);
  }

  useEffect(() => {
    loadKits().catch(() => setError(t("assets.loadFailed")));
  }, [t]);

  const filteredKits = useMemo(() => {
    const term = kitSearch.trim().toLowerCase();
    if (!term) return kits;
    return kits.filter((kit) =>
      [kit.name, ...(kit.items ?? []).flatMap((item) => [item.tag_number, item.name])]
        .some((v) => (v ?? "").toLowerCase().includes(term)),
    );
  }, [kits, kitSearch]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await assetsApi.createKit({ name: name.trim(), asset_ids: [...selected.keys()] });
      setName("");
      setSelected(new Map());
      await loadKits();
      setReloadKey((n) => n + 1);
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
        <label htmlFor="kit-name-field" className="block text-sm">
          {t("assets.kits.name")}
          <input id="kit-name-field" className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required data-testid="kit-name" />
        </label>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
          <AssetMultiPicker
            selected={selected}
            onChange={setSelected}
            reloadKey={reloadKey}
            testId="kit-assets"
            searchTestId="kit-asset-search"
            optionTestIdPrefix="kit-asset-"
          />
        </fieldset>
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()} data-testid="kit-create">{t("assets.kits.create")}</button>
      </form>
      {kits.length === 0 ? (
        <EmptyState title="assets.kits.empty" />
      ) : (
        <div className="space-y-3">
          <SearchField value={kitSearch} onChange={setKitSearch} placeholder={t("assets.kits.searchKits")} testId="kit-search" />
          {filteredKits.length === 0 ? <p className="text-sm text-neutral-500">{t("common.noResults")}</p> : null}
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
