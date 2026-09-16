"use client";

import { FormEvent, useEffect, useState } from "react";
import { assetsApi, assetMetaApi, tenantUsersApi, type Asset, type AssetAttestationCampaign, type AssetEquipmentTemplate, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type LocationRow = { id: number; name: string; code: string };

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
  const [attestAssetIds, setAttestAssetIds] = useState("");
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
          <input className="form-input" placeholder={t("assets.ops.templateName")} value={templateName} onChange={(e) => setTemplateName(e.target.value)} required />
          <input className="form-input" placeholder={t("assets.ops.roleName")} value={roleName} onChange={(e) => setRoleName(e.target.value)} required />
          <input className="form-input" placeholder={t("assets.ops.categories")} value={categories} onChange={(e) => setCategories(e.target.value)} required />
          <button type="submit" className="btn-primary sm:col-span-3">{t("common.save")}</button>
        </form>
        <ul className="text-sm">{templates.map((row) => <li key={row.id}>{row.name} · {row.role_name} · {(row.required_categories ?? []).join(", ")}</li>)}</ul>
        <div className="flex flex-wrap gap-2">
          <select className="form-input" value={gapUserId} onChange={(e) => setGapUserId(e.target.value)}>
            <option value="">{t("assets.handover.inCustodyOf")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => void wrap(async () => {
              const r = await assetsApi.equipmentTemplateGaps(Number(gapUserId));
              setMissing(r.data.data.missing_categories ?? []);
            })}
            disabled={!gapUserId}
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
          <select className="form-input" value={plannerAssetId} onChange={(e) => setPlannerAssetId(e.target.value)} required>
            <option value="">{t("assets.handover.selectAssets")}</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.tag_number || a.asset_code} — {a.name}</option>)}
          </select>
          <select className="form-input" value={plannerUserId} onChange={(e) => setPlannerUserId(e.target.value)} required>
            <option value="">{t("assets.handover.inCustodyOf")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <input className="form-input" value={plannerNotes} onChange={(e) => setPlannerNotes(e.target.value)} placeholder={t("assets.view.fieldNotes")} />
          <button type="submit" className="btn-primary sm:col-span-3">{t("assets.scan.action.startHandover")}</button>
        </form>
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ops-attest">
        <h2 id="ops-attest" className="font-semibold">{t("assets.ops.attestations")}</h2>
        <p className="text-sm text-neutral-600">{t("assets.ops.attestHint")}</p>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              await assetsApi.createAttestation({ name: campaignName.trim(), due_on: dueOn || undefined });
              setCampaignName("");
            });
          }}
        >
          <input className="form-input" placeholder={t("assets.ops.campaignName")} value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required />
          <input className="form-input" type="date" aria-label={t("assets.ops.dueOn")} value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
          <button type="submit" className="btn-primary sm:col-span-2">{t("common.save")}</button>
        </form>
        <ul className="text-sm">{campaigns.map((c) => <li key={c.id}>{c.name} · {c.status}</li>)}</ul>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            void wrap(async () => {
              await assetsApi.attestAssets(Number(attestId), {
                asset_ids: attestAssetIds.split(",").map((s) => Number(s.trim())).filter((n) => n > 0),
                confirmed: true,
              });
            });
          }}
        >
          <select className="form-input" value={attestId} onChange={(e) => setAttestId(e.target.value)} required>
            <option value="">{t("assets.ops.campaignName")}</option>
            {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input className="form-input" placeholder="asset ids" value={attestAssetIds} onChange={(e) => setAttestAssetIds(e.target.value)} required />
          <button type="submit" className="btn-secondary sm:col-span-2">{t("assets.ops.attest")}</button>
        </form>
      </section>

      <section className="card space-y-3 p-4" aria-labelledby="ops-room">
        <h2 id="ops-room" className="font-semibold">{t("assets.ops.room")}</h2>
        <div className="flex flex-wrap gap-2">
          <select className="form-input" value={roomLocationId} onChange={(e) => setRoomLocationId(e.target.value)}>
            <option value="">{t("assets.scan.location")}</option>
            {locations.map((loc) => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={!roomLocationId}
            onClick={() => void wrap(async () => {
              const r = await assetsApi.issueRoomToken(Number(roomLocationId));
              setRoomToken(r.data.data.qr_token);
            })}
          >
            {t("assets.ops.issueRoom")}
          </button>
          <input className="form-input" value={roomToken} onChange={(e) => setRoomToken(e.target.value)} placeholder="rm_…" />
          <button
            type="button"
            className="btn-primary"
            disabled={!roomToken}
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
