"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { assetsApi, tenantUsersApi, type Asset, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

function NewHandoverForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [type, setType] = useState(params.get("type") || "issue");
  const [target, setTarget] = useState("person");
  const [toUserId, setToUserId] = useState("");
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [batchAssetIds, setBatchAssetIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preset = Number(params.get("assetId") || 0);
  const batchId = Number(params.get("batchId") || 0);

  useEffect(() => {
    tenantUsersApi.list().then((r) => setUsers(r.data.data ?? [])).catch(() => setUsers([]));
  }, []);

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

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const created = await assetsApi.createHandover({
        type,
        custody_target_type: target,
        to_user_id: target === "person" ? Number(toUserId) : undefined,
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
        <label className="block text-sm">
          {t("assets.handover.type")}
          <select className="form-input mt-1" value={type} onChange={(e) => setType(e.target.value)}>
            <option value="issue">issue</option>
            <option value="transfer">transfer</option>
            <option value="return">return</option>
          </select>
        </label>
        <label className="block text-sm">
          {t("assets.handover.target")}
          <select className="form-input mt-1" value={target} onChange={(e) => setTarget(e.target.value)}>
            <option value="person">person</option>
            <option value="department">department</option>
            <option value="location">location</option>
            <option value="pool">pool</option>
            <option value="vehicle_facility">vehicle_facility</option>
          </select>
        </label>
        {target === "person" && (
          <label className="block text-sm">
            {t("assets.handover.inCustodyOf")}
            <select className="form-input mt-1" value={toUserId} onChange={(e) => setToUserId(e.target.value)} required data-testid="handover-to-user">
              <option value="">{t("assets.notAssigned")}</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ""}</option>
              ))}
            </select>
          </label>
        )}
        <fieldset>
          <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
          <div className="mt-2 max-h-64 overflow-auto space-y-1">
            {assets.map((asset) => (
              <label key={asset.id} className="flex items-center gap-2 text-sm" data-testid={`handover-asset-${asset.id}`}>
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
