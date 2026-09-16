"use client";

import { FormEvent, useEffect, useState } from "react";
import { assetsApi, type Asset, type AssetKit } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetKitsPage() {
  const { t } = useI18n();
  const [kits, setKits] = useState<AssetKit[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [kitRes, assetRes] = await Promise.all([
      assetsApi.kits(),
      assetsApi.list({ per_page: 100 }),
    ]);
    setKits(kitRes.data.data ?? []);
    setAssets(assetRes.data.data ?? []);
  }

  useEffect(() => {
    load().catch(() => setError(t("assets.loadFailed")));
  }, [t]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await assetsApi.createKit({ name: name.trim(), asset_ids: selected });
      setName("");
      setSelected([]);
      await load();
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
          <input className="form-input mt-1" value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <fieldset>
          <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
          <div className="mt-2 max-h-48 overflow-auto space-y-1">
            {assets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(asset.id)}
                  onChange={(e) => setSelected((cur) => e.target.checked ? [...cur, asset.id] : cur.filter((id) => id !== asset.id))}
                />
                <span className="font-mono text-xs">{asset.tag_number || asset.asset_code}</span>
                <span>{asset.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary" disabled={busy || !name.trim()}>{t("assets.kits.create")}</button>
      </form>
      {kits.length === 0 ? (
        <EmptyState title="assets.kits.empty" />
      ) : (
        <div className="space-y-3">
          {kits.map((kit) => (
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
