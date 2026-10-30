"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { assetsApi, type Asset, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { SearchField } from "@/components/ui/SearchField";

function NewHandoverForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [type, setType] = useState(params.get("type") || "issue");
  const [target, setTarget] = useState("person");
  const [toUser, setToUser] = useState<TenantUserOption | null>(null);
  const [delegateUser, setDelegateUser] = useState<TenantUserOption | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [batchAssetIds, setBatchAssetIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [assetSearch, setAssetSearch] = useState("");
  const [searchResults, setSearchResults] = useState<Asset[] | null>(null);

  const preset = Number(params.get("assetId") || 0);
  const batchId = Number(params.get("batchId") || 0);

  // Search the whole register (not just the preloaded first page) as the user types.
  useEffect(() => {
    const term = assetSearch.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await assetsApi.list({ search: term, status: type === "issue" ? "available" : undefined, per_page: 100 });
        if (!cancelled) setSearchResults(res.data.data ?? []);
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [assetSearch, type]);

  useEffect(() => {
    let cancelled = false;
    async function loadAssets() {
      const collected = new Map<number, Asset>();
      const status = type === "issue" ? "available" : undefined;
      if (!batchId) {
        try {
          const listed = await assetsApi.list({ status, per_page: 100 });
          for (const row of listed.data.data ?? []) collected.set(row.id, row);
        } catch {
          /* ignore */
        }
      }
      if (batchId) {
        try {
          const batch = await assetsApi.getBatch(batchId);
          const ids: number[] = [];
          for (const item of batch.data.data.items ?? []) {
            if (item.asset) {
              collected.set(item.asset.id, item.asset);
              ids.push(item.asset.id);
            } else if (item.asset_id) {
              ids.push(item.asset_id);
              try {
                const one = await assetsApi.get(item.asset_id);
                collected.set(item.asset_id, one.data);
              } catch {
                /* ignore */
              }
            }
          }
          if (!cancelled) setBatchAssetIds(ids);
        } catch {
          /* ignore */
        }
      }
      if (preset) {
        try {
          const one = await assetsApi.get(preset);
          collected.set(preset, one.data);
        } catch {
          /* ignore */
        }
      }
      if (!cancelled) setAssets([...collected.values()]);
    }
    void loadAssets();
    return () => {
      cancelled = true;
    };
  }, [type, batchId, preset]);

  const initial = useMemo(() => {
    const ids: number[] = [];
    if (preset) ids.push(preset);
    return ids;
  }, [preset]);

  useEffect(() => {
    if (initial.length) setSelected((cur) => Array.from(new Set([...cur, ...initial])));
  }, [initial]);

  useEffect(() => {
    if (batchAssetIds.length) setSelected((cur) => Array.from(new Set([...cur, ...batchAssetIds])));
  }, [batchAssetIds]);

  // While searching, keep already-selected assets pinned above the matches.
  const shownAssets = useMemo(() => {
    if (searchResults === null) return assets;
    const matched = new Set(searchResults.map((a) => a.id));
    const pinned = assets.filter((a) => selected.includes(a.id) && !matched.has(a.id));
    return [...pinned, ...searchResults];
  }, [assets, searchResults, selected]);

  function toggleAsset(asset: Asset, checked: boolean) {
    if (checked) {
      // Remember assets picked from a search so they stay listed after the search changes.
      setAssets((cur) => (cur.some((a) => a.id === asset.id) ? cur : [...cur, asset]));
      setSelected((cur) => (cur.includes(asset.id) ? cur : [...cur, asset.id]));
    } else {
      setSelected((cur) => cur.filter((id) => id !== asset.id));
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await assetsApi.createHandover({
        type,
        custody_target_type: target,
        to_user_id: target === "person" ? toUser?.id : undefined,
        delegate_user_id: target === "person" && delegateUser ? delegateUser.id : undefined,
        asset_ids: selected,
      });
      const id = created.data.data.id;
      await assetsApi.sendHandover(id);
      router.push(`/assets/handovers/${id}`);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.assignFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.handover.create"
        subtitle="assets.handover.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets/handovers", label: t("assets.handover.title") }, { label: t("assets.handover.create") }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      <form onSubmit={submit} className="card space-y-4 p-4" data-testid="handover-create-form">
        <label htmlFor="assets-handovers-new-field-1" className="block text-sm">
          {t("assets.handover.type")}
          <select id="assets-handovers-new-field-1" className="form-input mt-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="issue">issue</option>
            <option value="transfer">transfer</option>
            <option value="return">return</option>
          </select>
        </label>
        <label htmlFor="assets-handovers-new-field-2" className="block text-sm">
          {t("assets.handover.target")}
          <select id="assets-handovers-new-field-2" className="form-input mt-1" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="person">person</option>
            <option value="department">department</option>
            <option value="location">location</option>
            <option value="pool">pool</option>
            <option value="vehicle_facility">vehicle_facility</option>
          </select>
        </label>
        {target === "person" && (
          <>
          <div data-testid="handover-to-user">
            <AssetAssigneePicker
              id="handover-to-user"
              label={t("assets.handover.inCustodyOf")}
              value={toUser}
              onSelect={setToUser}
              required
            />
          </div>
          <div data-testid="handover-delegate">
            <AssetAssigneePicker
              id="handover-delegate"
              label={t("assets.handover.delegate")}
              includeInvited={false}
              value={delegateUser}
              onSelect={setDelegateUser}
              hint={t("assets.handover.delegateHint")}
            />
          </div>
          </>
        )}
        <fieldset>
          <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
          <div className="mt-2 space-y-2">
            <SearchField
              value={assetSearch}
              onChange={setAssetSearch}
              placeholder={t("assets.picker.search")}
              testId="handover-asset-search"
            />
            <p className="text-xs text-neutral-500" data-testid="handover-selected-count">
              {t("assets.picker.selectedCount", { count: selected.length })}
            </p>
          </div>
          <div className="mt-2 max-h-64 overflow-auto space-y-1">
            {searchResults !== null && shownAssets.length === 0 ? (
              <p className="py-2 text-sm text-neutral-500">{t("common.noResults")}</p>
            ) : null}
            {shownAssets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm" data-testid={`handover-asset-${asset.id}`}>
                <input
                  type="checkbox"
                  checked={selected.includes(asset.id)}
                  onChange={(e) => toggleAsset(asset, e.target.checked)}
                />
                <span className="font-mono text-xs">{asset.tag_number || asset.asset_code}</span>
                <span>{asset.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="btn-primary" disabled={busy || selected.length === 0} data-testid="handover-send">
          {busy ? t("common.loading") : t("assets.handover.send")}
        </button>
      </form>
    </div>
  );
}

export default function NewHandoverPage() {
  return (
    <Suspense>
      <NewHandoverForm />
    </Suspense>
  );
}
