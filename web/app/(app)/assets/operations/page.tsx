"use client";

import { FormEvent, useEffect, useState } from "react";
import { assetsApi, assetMetaApi, tenantUsersApi, type Asset, type AssetAttestationCampaign, type AssetEquipmentTemplate, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type LocationRow = { id: number; name: string; code: string };

function assetLabel(asset: Asset): string {
  return `${asset.tag_number || asset.asset_code} — ${asset.name}`;
}

export default function AssetOperationsPage() {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [templates, setTemplates] = useState<AssetEquipmentTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<AssetAttestationCampaign[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [roleName, setRoleName] = useState("staff");
  const [categories, setCategories] = useState("ICT");
  const [gapUserId, setGapUserId] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [plannerAssetId, setPlannerAssetId] = useState("");
  const [plannerUserId, setPlannerUserId] = useState("");
  const [plannerNotes, setPlannerNotes] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [attestId, setAttestId] = useState("");
  const [attestAssetIds, setAttestAssetIds] = useState<number[]>([]);
  const [roomLocationId, setRoomLocationId] = useState("");
  const [roomToken, setRoomToken] = useState("");
  const [roomAssets, setRoomAssets] = useState<Array<Record<string, unknown>>>([]);

  async function load() {
    const [userRes, assetRes, templateRes, campaignRes, locRes] = await Promise.all([
      tenantUsersApi.list(),
      assetsApi.list({ per_page: 100 }),
      assetsApi.equipmentTemplates().catch(() => ({ data: { data: [] as AssetEquipmentTemplate[] } })),
      assetsApi.attestations().catch(() => ({ data: { data: [] as AssetAttestationCampaign[] } })),
      assetMetaApi.locations().catch(() => ({ data: { data: [] as LocationRow[] } })),
    ]);
    setUsers(userRes.data.data ?? []);
    setAssets(assetRes.data.data ?? []);
    setTemplates(templateRes.data.data ?? []);
    setCampaigns(campaignRes.data.data ?? []);
    const locData = (locRes.data as { data?: LocationRow[] }).data ?? [];
    setLocations(Array.isArray(locData) ? locData : []);
  }

  useEffect(() => {
    load().catch(() => setError(t("assets.loadFailed")));
  }, [t]);

  async function wrap(action: () => Promise<void>) {
    setError("");
    try {
      await action();
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.mine.actionFailed")));
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.ops.title"
        subtitle="assets.ops.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.ops.title" }]} />}
      />
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}

      <section className="card space-y-3 p-4" aria-labelledby="ops-templates">
        <h2 id="ops-templates" className="font-semibold">{t("assets.ops.templates")}</h2>
        <form
          className="grid gap-3 sm:grid-cols-3"
          data-testid="ops-template-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              await assetsApi.createEquipmentTemplate({
                name: templateName.trim(),
                role_name: roleName.trim(),
                required_categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
              });
              setTemplateName("");
            });
          }}
        >
          <label className="block text-sm">
            {t("assets.ops.templateName")}
            <input className="form-input mt-1" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required data-testid="ops-template-name" />
          </label>
          <label className="block text-sm">
            {t("assets.ops.roleName")}
            <input className="form-input mt-1" value={roleName} onChange={(e) => setRoleName(e.target.value)} required data-testid="ops-template-role" />
          </label>
          <label className="block text-sm">
            {t("assets.ops.categories")}
            <input className="form-input mt-1" value={categories} onChange={(e) => setCategories(e.target.value)} required data-testid="ops-template-categories" />
          </label>
          <button type="submit" className="btn-primary sm:col-span-3" data-testid="ops-template-save">{t("common.save")}</button>
        </form>
        <ul className="text-sm">{templates.map((row) => <li key={row.id}>{row.name} · {row.role_name} · {(row.required_categories ?? []).join(", ")}</li>)}</ul>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            {t("assets.handover.inCustodyOf")}
            <select className="form-input mt-1" value={gapUserId} onChange={(e) => setGapUserId(e.target.value)} data-testid="ops-gap-user">
              <option value="">{t("assets.notAssigned")}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ""}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void wrap(async () => {
              const r = await assetsApi.equipmentTemplateGaps(Number(gapUserId));
              setMissing(r.data.data.missing_categories ?? []);
            })}
            disabled={!gapUserId}
            data-testid="ops-gaps"
          >
            {t("assets.ops.gaps")}
          </button>
        </div>
        {missing.length > 0 ? <p className="text-sm">{t("assets.ops.missing")}: {missing.join(", ")}</p> : null}
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ops-planner">
        <h2 id="ops-planner" className="font-semibold">{t("assets.ops.planner")}</h2>
        <p className="text-sm text-neutral-600">{t("assets.ops.plannerHint")}</p>
        <form
          className="grid gap-3 sm:grid-cols-3"
          data-testid="ops-planner-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              const created = await assetsApi.createPlannerSlot({
                asset_id: Number(plannerAssetId),
                to_user_id: Number(plannerUserId),
                notes: plannerNotes || undefined,
              });
              window.location.href = `/assets/handovers/${created.data.data.handover.id}`;
            });
          }}
        >
          <label className="block text-sm">
            {t("assets.handover.selectAssets")}
            <select className="form-input mt-1" value={plannerAssetId} onChange={(e) => setPlannerAssetId(e.target.value)} required data-testid="ops-planner-asset">
              <option value="">{t("assets.notAssigned")}</option>
              {assets.map((a) => <option key={a.id} value={a.id}>{assetLabel(a)}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            {t("assets.handover.inCustodyOf")}
            <select className="form-input mt-1" value={plannerUserId} onChange={(e) => setPlannerUserId(e.target.value)} required data-testid="ops-planner-user">
              <option value="">{t("assets.notAssigned")}</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.name}{u.email ? ` (${u.email})` : ""}</option>)}
            </select>
          </label>
          <label className="block text-sm">
            {t("assets.view.fieldNotes")}
            <input className="form-input mt-1" value={plannerNotes} onChange={(e) => setPlannerNotes(e.target.value)} data-testid="ops-planner-notes" />
          </label>
          <button type="submit" className="btn-primary sm:col-span-3" data-testid="ops-planner-save">{t("assets.scan.action.startHandover")}</button>
        </form>
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ops-attest">
        <h2 id="ops-attest" className="font-semibold">{t("assets.ops.attestations")}</h2>
        <p className="text-sm text-neutral-600">{t("assets.ops.attestHint")}</p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          data-testid="ops-campaign-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              await assetsApi.createAttestation({ name: campaignName.trim(), due_on: dueOn || undefined });
              setCampaignName("");
            });
          }}
        >
          <label className="block text-sm">
            {t("assets.ops.campaignName")}
            <input className="form-input mt-1" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required data-testid="ops-campaign-name" />
          </label>
          <label className="block text-sm">
            {t("assets.ops.dueOn")}
            <input className="form-input mt-1" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} data-testid="ops-campaign-due" />
          </label>
          <button type="submit" className="btn-primary sm:col-span-2" data-testid="ops-campaign-save">{t("common.save")}</button>
        </form>
        <ul className="text-sm">{campaigns.map((c) => <li key={c.id}>{c.name} · {c.status}</li>)}</ul>
        <form
          className="grid gap-3"
          data-testid="ops-attest-form"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              await assetsApi.attestAssets(Number(attestId), {
                asset_ids: attestAssetIds,
                confirmed: true,
              });
              setAttestAssetIds([]);
            });
          }}
        >
          <label className="block text-sm">
            {t("assets.ops.campaignName")}
            <select className="form-input mt-1" value={attestId} onChange={(e) => setAttestId(e.target.value)} required data-testid="ops-attest-campaign">
              <option value="">{t("assets.notAssigned")}</option>
              {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <fieldset data-testid="ops-attest-assets">
            <legend className="text-sm font-medium">{t("assets.handover.selectAssets")}</legend>
            <div className="mt-2 max-h-48 overflow-auto space-y-1">
              {assets.map((asset) => (
                <label key={asset.id} className="flex items-center gap-2 text-sm" data-testid={`ops-attest-asset-${asset.id}`}>
                  <input
                    type="checkbox"
                    checked={attestAssetIds.includes(asset.id)}
                    onChange={(e) => setAttestAssetIds((cur) => e.target.checked ? [...cur, asset.id] : cur.filter((id) => id !== asset.id))}
                  />
                  <span className="font-mono text-xs">{asset.tag_number || asset.asset_code}</span>
                  <span>{asset.name}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <button type="submit" className="btn-secondary" disabled={!attestId || attestAssetIds.length === 0} data-testid="ops-attest-save">{t("assets.ops.attest")}</button>
        </form>
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ops-room">
        <h2 id="ops-room" className="font-semibold">{t("assets.ops.room")}</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            {t("assets.scan.location")}
            <select className="form-input mt-1" value={roomLocationId} onChange={(e) => setRoomLocationId(e.target.value)} data-testid="ops-room-location">
              <option value="">{t("assets.notAssigned")}</option>
              {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
            </select>
          </label>
          <button
            type="button"
            className="btn-secondary"
            disabled={!roomLocationId}
            data-testid="ops-room-issue"
            onClick={() => void wrap(async () => {
              const r = await assetsApi.issueRoomToken(Number(roomLocationId));
              setRoomToken(r.data.data.qr_token);
            })}
          >
            {t("assets.ops.issueRoom")}
          </button>
          <label className="text-sm">
            {t("assets.ops.roomToken")}
            <input className="form-input mt-1 font-mono" value={roomToken} onChange={(e) => setRoomToken(e.target.value)} data-testid="ops-room-token" />
          </label>
          <button
            type="button"
            className="btn-primary"
            disabled={!roomToken}
            data-testid="ops-room-lookup"
            onClick={() => void wrap(async () => {
              const r = await assetsApi.roomByToken(roomToken);
              setRoomAssets(r.data.data.assets ?? []);
            })}
          >
            {t("assets.ops.lookupRoom")}
          </button>
        </div>
        <ul className="text-sm">{roomAssets.map((row) => <li key={String(row.id)}>{String(row.tag_number || row.asset_code)} — {String(row.name)}</li>)}</ul>
      </section>
    </div>
  );
}
