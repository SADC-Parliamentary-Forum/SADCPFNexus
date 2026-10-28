"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  assetCategoriesApi,
  assetsApi,
  assetMetaApi,
  type Asset,
  type AssetAttestationCampaign,
  type AssetCategory,
  type AssetEquipmentTemplate,
  type TenantUserOption,
} from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { NexusPicker } from "@/components/ui/NexusPicker";
import { AssetAssigneePicker } from "@/components/assets/AssetAssigneePicker";
import { AssetPicker } from "@/components/assets/AssetPicker";
import { AssetMultiPicker } from "@/components/assets/AssetMultiPicker";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type LocationRow = { id: number; name: string; code: string };
type RoomAsset = { id?: number; tag_number?: string; asset_code?: string; name?: string; status?: string };
type Tab = "issue" | "gaps" | "attest" | "room";

const TABS: Array<{ id: Tab; icon: string; title: string; hint: string }> = [
  { id: "issue", icon: "assignment_ind", title: "assets.ops.tab.issue", hint: "assets.ops.tab.issueHint" },
  { id: "gaps", icon: "checklist", title: "assets.ops.tab.gaps", hint: "assets.ops.tab.gapsHint" },
  { id: "attest", icon: "fact_check", title: "assets.ops.tab.attest", hint: "assets.ops.tab.attestHint" },
  { id: "room", icon: "qr_code_2", title: "assets.ops.tab.room", hint: "assets.ops.tab.roomHint" },
];

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{n}</span>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm font-medium text-neutral-900">{title}</p>
        {children}
      </div>
    </div>
  );
}

export default function AssetOperationsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("issue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  // Reference data
  const [templates, setTemplates] = useState<AssetEquipmentTemplate[]>([]);
  const [campaigns, setCampaigns] = useState<AssetAttestationCampaign[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [categoryList, setCategoryList] = useState<AssetCategory[]>([]);

  // Issue
  const [plannerAsset, setPlannerAsset] = useState<Asset | null>(null);
  const [plannerUser, setPlannerUser] = useState<TenantUserOption | null>(null);
  const [plannerNotes, setPlannerNotes] = useState("");

  // Gaps + role standards
  const [gapUser, setGapUser] = useState<TenantUserOption | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [templateName, setTemplateName] = useState("");
  const [roleName, setRoleName] = useState("staff");
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryDraft, setCategoryDraft] = useState("");

  // Attestation
  const [campaignName, setCampaignName] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [attestId, setAttestId] = useState<number | null>(null);
  const [attestAssets, setAttestAssets] = useState<Map<number, Asset>>(new Map());
  const [attestReload, setAttestReload] = useState(0);

  // Room
  const [roomLocation, setRoomLocation] = useState<LocationRow | null>(null);
  const [roomToken, setRoomToken] = useState("");
  const [roomAssets, setRoomAssets] = useState<RoomAsset[] | null>(null);

  async function load() {
    const [templateRes, campaignRes, locRes, catRes] = await Promise.all([
      assetsApi.equipmentTemplates().catch(() => ({ data: { data: [] as AssetEquipmentTemplate[] } })),
      assetsApi.attestations().catch(() => ({ data: { data: [] as AssetAttestationCampaign[] } })),
      assetMetaApi.locations().catch(() => ({ data: { data: [] as LocationRow[] } })),
      assetCategoriesApi.list().catch(() => ({ data: { data: [] as AssetCategory[] } })),
    ]);
    setTemplates(templateRes.data.data ?? []);
    setCampaigns(campaignRes.data.data ?? []);
    const locData = (locRes.data as { data?: LocationRow[] }).data ?? [];
    setLocations(Array.isArray(locData) ? locData : []);
    setCategoryList(catRes.data.data ?? []);
  }

  useEffect(() => {
    load().catch(() => setError(t("assets.loadFailed")));
    const fromHash = window.location.hash.replace("#", "") as Tab;
    if (TABS.some((x) => x.id === fromHash)) setTab(fromHash);
  }, [t]);

  function switchTab(next: Tab) {
    setTab(next);
    setError("");
    setNotice("");
    window.history.replaceState(null, "", `#${next}`);
  }

  async function run(action: () => Promise<void>) {
    setError("");
    setNotice("");
    setBusy(true);
    try {
      await action();
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.mine.actionFailed")));
    } finally {
      setBusy(false);
    }
  }

  const categoryName = useMemo(() => {
    const map = new Map(categoryList.map((c) => [c.code.toLowerCase(), c.name]));
    return (code: string) => map.get(code.toLowerCase()) ?? code;
  }, [categoryList]);

  const roleSuggestions = useMemo(
    () => [...new Set(["staff", ...templates.map((x) => x.role_name)])],
    [templates],
  );

  function addCategory(code: string) {
    const clean = code.trim();
    if (!clean) return;
    setCategories((cur) => (cur.some((c) => c.toLowerCase() === clean.toLowerCase()) ? cur : [...cur, clean]));
    setCategoryDraft("");
  }

  const selectedCampaign = campaigns.find((c) => c.id === attestId) ?? null;

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.ops.title"
        subtitle="assets.ops.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ href: "/assets", label: "nav.assets" }, { label: "assets.ops.title" }]} />}
      />

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="tablist" aria-label={t("assets.ops.title")}>
        {TABS.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tab === x.id}
            data-testid={`ops-tab-${x.id}`}
            onClick={() => switchTab(x.id)}
            className={`flex items-start gap-3 rounded-xl border p-3 text-left transition ${
              tab === x.id ? "border-primary bg-primary/5" : "border-neutral-200 bg-white hover:border-neutral-300"
            }`}
          >
            <span className={`material-symbols-outlined text-[22px] ${tab === x.id ? "text-primary" : "text-neutral-500"}`} aria-hidden="true">{x.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-neutral-900">{t(x.title)}</span>
              <span className="block text-xs text-neutral-500">{t(x.hint)}</span>
            </span>
          </button>
        ))}
      </div>

      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {notice ? <p role="status" className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{notice}</p> : null}

      {tab === "issue" ? (
        <section className="card space-y-4 p-4" aria-labelledby="ops-planner" role="tabpanel">
          <div>
            <h2 id="ops-planner" className="font-semibold">{t("assets.ops.tab.issue")}</h2>
            <p className="text-sm text-neutral-600">{t("assets.ops.plannerHint")}</p>
          </div>
          <form
            className="space-y-4"
            data-testid="ops-planner-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!plannerAsset || !plannerUser) return;
              void run(async () => {
                const created = await assetsApi.createPlannerSlot({
                  asset_id: plannerAsset.id,
                  to_user_id: plannerUser.id,
                  notes: plannerNotes || undefined,
                });
                window.location.href = `/assets/handovers/${created.data.data.handover.id}`;
              });
            }}
          >
            <Step n={1} title={t("assets.ops.step.pickAsset")}>
              <div data-testid="ops-planner-asset">
                <AssetPicker
                  id="ops-planner-asset-input"
                  label={t("assets.picker.asset")}
                  value={plannerAsset}
                  onSelect={setPlannerAsset}
                  status="available"
                  required
                  hint={t("assets.ops.availableOnly")}
                  dataTestId="ops-planner-asset-input"
                />
              </div>
            </Step>
            <Step n={2} title={t("assets.ops.step.pickPerson")}>
              <div data-testid="ops-planner-user">
                <AssetAssigneePicker
                  id="ops-planner-user"
                  label={t("assets.handover.inCustodyOf")}
                  value={plannerUser}
                  onSelect={setPlannerUser}
                  required
                />
              </div>
            </Step>
            <Step n={3} title={t("assets.ops.step.notes")}>
              <input
                className="form-input"
                value={plannerNotes}
                onChange={(e) => setPlannerNotes(e.target.value)}
                placeholder={t("assets.ops.notesPlaceholder")}
                aria-label={t("assets.view.fieldNotes")}
                data-testid="ops-planner-notes"
              />
            </Step>
            <button type="submit" className="btn-primary" disabled={busy || !plannerAsset || !plannerUser} data-testid="ops-planner-save">
              {t("assets.ops.prepareHandover")}
            </button>
          </form>
        </section>
      ) : null}

      {tab === "gaps" ? (
        <div className="space-y-4" role="tabpanel">
          <section className="card space-y-3 p-4" aria-labelledby="ops-gaps-title">
            <div>
              <h2 id="ops-gaps-title" className="font-semibold">{t("assets.ops.checkPerson")}</h2>
              <p className="text-sm text-neutral-600">{t("assets.ops.checkPersonHint")}</p>
            </div>
            <div className="flex flex-wrap items-end gap-2" data-testid="ops-gap-user">
              <div className="min-w-[260px] flex-1">
                <AssetAssigneePicker
                  id="ops-gap-user"
                  label={t("assets.ops.person")}
                  value={gapUser}
                  onSelect={(u) => {
                    setGapUser(u);
                    setMissing(null);
                  }}
                />
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={!gapUser || busy}
                data-testid="ops-gaps"
                onClick={() => void run(async () => {
                  const r = await assetsApi.equipmentTemplateGaps(Number(gapUser?.id));
                  setMissing(r.data.data.missing_categories ?? []);
                })}
              >
                {t("assets.ops.gaps")}
              </button>
            </div>
            {missing !== null ? (
              missing.length === 0 ? (
                <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="ops-gaps-none">{t("assets.ops.noGaps")}</p>
              ) : (
                <div className="space-y-2" data-testid="ops-gaps-result">
                  <p className="text-sm">{t("assets.ops.missing")}:</p>
                  <ul className="flex flex-wrap gap-2">
                    {missing.map((code) => (
                      <li key={code} className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-sm text-amber-900">
                        {categoryName(code)}
                      </li>
                    ))}
                  </ul>
                  <button type="button" className="btn-primary text-sm" onClick={() => switchTab("issue")}>
                    {t("assets.ops.issueMissing")}
                  </button>
                </div>
              )
            ) : null}
          </section>

          <section className="card space-y-3 p-4" aria-labelledby="ops-templates">
            <div>
              <h2 id="ops-templates" className="font-semibold">{t("assets.ops.templates")}</h2>
              <p className="text-sm text-neutral-600">{t("assets.ops.templatesHint")}</p>
            </div>
            {templates.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("assets.ops.noTemplates")}</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {templates.map((row) => (
                  <li key={row.id} className="rounded-lg border border-neutral-200 p-3 text-sm">
                    <p className="font-medium text-neutral-900">{row.name}</p>
                    <p className="text-xs text-neutral-500">{t("assets.ops.roleName")}: {row.role_name}</p>
                    <p className="mt-1 flex flex-wrap gap-1">
                      {(row.required_categories ?? []).map((c) => (
                        <span key={c} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs">{categoryName(c)}</span>
                      ))}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            <form
              className="grid gap-3 border-t border-neutral-100 pt-3 sm:grid-cols-2"
              data-testid="ops-template-form"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                const required = [...categories];
                if (categoryDraft.trim() && !required.includes(categoryDraft.trim())) required.push(categoryDraft.trim());
                if (required.length === 0) {
                  setError(t("assets.ops.categoriesRequired"));
                  return;
                }
                void run(async () => {
                  await assetsApi.createEquipmentTemplate({ name: templateName.trim(), role_name: roleName.trim(), required_categories: required });
                  setTemplateName("");
                  setCategories([]);
                  setCategoryDraft("");
                  await load();
                  setNotice(t("assets.ops.templateSaved"));
                });
              }}
            >
              <label htmlFor="ops-template-name-field" className="block text-sm">
                {t("assets.ops.templateName")}
                <input id="ops-template-name-field" className="form-input mt-1" value={templateName} onChange={(e) => setTemplateName(e.target.value)} required placeholder={t("assets.ops.templateNamePlaceholder")} data-testid="ops-template-name" />
              </label>
              <label htmlFor="ops-template-role-field" className="block text-sm">
                {t("assets.ops.roleName")}
                <input id="ops-template-role-field" className="form-input mt-1" list="ops-role-suggestions" value={roleName} onChange={(e) => setRoleName(e.target.value)} required data-testid="ops-template-role" />
                <datalist id="ops-role-suggestions">
                  {roleSuggestions.map((r) => <option key={r} value={r} />)}
                </datalist>
              </label>
              <div className="block text-sm sm:col-span-2">
                <label htmlFor="ops-template-categories">{t("assets.ops.categories")}</label>
                <div className="mt-1 flex flex-wrap items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 p-2">
                  {categories.map((c) => (
                    <span key={c} className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                      {categoryName(c)}
                      <button type="button" aria-label={t("assets.picker.remove", { name: categoryName(c) })} onClick={() => setCategories((cur) => cur.filter((x) => x !== c))}>
                        <span className="material-symbols-outlined text-[14px]" aria-hidden="true">close</span>
                      </button>
                    </span>
                  ))}
                  <input
                    id="ops-template-categories"
                    className="min-w-[160px] flex-1 bg-transparent text-sm outline-none"
                    list="ops-category-suggestions"
                    value={categoryDraft}
                    placeholder={t("assets.ops.categoriesPlaceholder")}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v.endsWith(",")) addCategory(v.slice(0, -1));
                      else setCategoryDraft(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && categoryDraft.trim()) {
                        e.preventDefault();
                        addCategory(categoryDraft);
                      }
                    }}
                    onBlur={() => addCategory(categoryDraft)}
                    data-testid="ops-template-categories"
                  />
                  <datalist id="ops-category-suggestions">
                    {categoryList.map((c) => <option key={c.id} value={c.code}>{c.name}</option>)}
                  </datalist>
                </div>
              </div>
              <button type="submit" className="btn-primary sm:col-span-2" disabled={busy} data-testid="ops-template-save">{t("assets.ops.saveTemplate")}</button>
            </form>
          </section>
        </div>
      ) : null}

      {tab === "attest" ? (
        <section className="card space-y-4 p-4" aria-labelledby="ops-attest" role="tabpanel">
          <div>
            <h2 id="ops-attest" className="font-semibold">{t("assets.ops.attestations")}</h2>
            <p className="text-sm text-neutral-600">{t("assets.ops.attestHint")}</p>
          </div>
          <Step n={1} title={t("assets.ops.step.campaign")}>
            {campaigns.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("assets.ops.noCampaigns")}</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" data-testid="ops-attest-campaign">
                {campaigns.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={attestId === c.id}
                    onClick={() => setAttestId(c.id)}
                    data-testid={`ops-attest-campaign-${c.id}`}
                    className={`rounded-lg border p-3 text-left text-sm ${attestId === c.id ? "border-primary bg-primary/5" : "border-neutral-200 hover:border-neutral-300"}`}
                  >
                    <span className="block font-medium text-neutral-900">{c.name}</span>
                    <span className="block text-xs text-neutral-500">
                      {[c.status, c.due_on ? t("assets.ops.dueLabel", { date: c.due_on.slice(0, 10) }) : null, typeof c.responses_count === "number" ? t("assets.ops.responses", { count: c.responses_count }) : null].filter(Boolean).join(" · ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            <details className="rounded-lg border border-dashed border-neutral-200 p-3">
              <summary className="cursor-pointer text-sm font-medium text-primary">{t("assets.ops.newCampaign")}</summary>
              <form
                className="mt-3 grid gap-3 sm:grid-cols-3"
                data-testid="ops-campaign-form"
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void run(async () => {
                    const created = await assetsApi.createAttestation({ name: campaignName.trim(), due_on: dueOn || undefined });
                    setCampaignName("");
                    setDueOn("");
                    await load();
                    const id = (created.data as { data?: { id?: number } }).data?.id;
                    if (id) setAttestId(id);
                    setNotice(t("assets.ops.campaignSaved"));
                  });
                }}
              >
                <label htmlFor="ops-campaign-name-field" className="block text-sm sm:col-span-2">
                  {t("assets.ops.campaignName")}
                  <input id="ops-campaign-name-field" className="form-input mt-1" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} required placeholder={t("assets.ops.campaignPlaceholder")} data-testid="ops-campaign-name" />
                </label>
                <label htmlFor="ops-campaign-due-field" className="block text-sm">
                  {t("assets.ops.dueOn")}
                  <input id="ops-campaign-due-field" className="form-input mt-1" type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} data-testid="ops-campaign-due" />
                </label>
                <button type="submit" className="btn-secondary sm:col-span-3" disabled={busy} data-testid="ops-campaign-save">{t("assets.ops.createCampaign")}</button>
              </form>
            </details>
          </Step>
          <form
            className="space-y-4"
            data-testid="ops-attest-form"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!attestId || attestAssets.size === 0) return;
              void run(async () => {
                const count = attestAssets.size;
                await assetsApi.attestAssets(attestId, { asset_ids: [...attestAssets.keys()], confirmed: true });
                setAttestAssets(new Map());
                setAttestReload((n) => n + 1);
                await load();
                setNotice(t("assets.ops.attested", { count }));
              });
            }}
          >
            <Step n={2} title={t("assets.ops.step.attestAssets")}>
              <div data-testid="ops-attest-assets">
                <AssetMultiPicker
                  selected={attestAssets}
                  onChange={setAttestAssets}
                  reloadKey={attestReload}
                  testId="ops-attest-picker"
                  searchTestId="ops-attest-search"
                  optionTestIdPrefix="ops-attest-asset-"
                />
              </div>
            </Step>
            <button type="submit" className="btn-primary" disabled={busy || !selectedCampaign || attestAssets.size === 0} data-testid="ops-attest-save">
              {t("assets.ops.attestCount", { count: attestAssets.size })}
            </button>
          </form>
        </section>
      ) : null}

      {tab === "room" ? (
        <section className="card space-y-4 p-4" aria-labelledby="ops-room" role="tabpanel">
          <div>
            <h2 id="ops-room" className="font-semibold">{t("assets.ops.room")}</h2>
            <p className="text-sm text-neutral-600">{t("assets.ops.roomHint")}</p>
          </div>
          <Step n={1} title={t("assets.ops.step.room")}>
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[260px] flex-1">
                <NexusPicker<LocationRow>
                  id="ops-room-location-input"
                  label={t("assets.scan.location")}
                  value={roomLocation}
                  onSelect={(loc) => {
                    setRoomLocation(loc);
                    setRoomToken("");
                    setRoomAssets(null);
                  }}
                  placeholder={t("assets.ops.searchRoom")}
                  dataTestId="ops-room-location"
                  maxOptions={20}
                  fetchOptions={async (q) => {
                    const term = q.trim().toLowerCase();
                    return locations.filter((l) => !term || l.name.toLowerCase().includes(term) || (l.code ?? "").toLowerCase().includes(term));
                  }}
                  getId={(l) => l.id}
                  getLabel={(l) => (l.code ? `${l.name} (${l.code})` : l.name)}
                />
              </div>
              <button
                type="button"
                className="btn-secondary"
                disabled={!roomLocation || busy}
                data-testid="ops-room-issue"
                onClick={() => void run(async () => {
                  const r = await assetsApi.issueRoomToken(Number(roomLocation?.id));
                  setRoomToken(r.data.data.qr_token);
                  const list = await assetsApi.roomByToken(r.data.data.qr_token);
                  setRoomAssets((list.data.data.assets ?? []) as RoomAsset[]);
                })}
              >
                {t("assets.ops.issueRoom")}
              </button>
            </div>
          </Step>
          <Step n={2} title={t("assets.ops.step.roomToken")}>
            <div className="flex flex-wrap items-end gap-2">
              <label htmlFor="ops-room-token-field" className="min-w-[260px] flex-1 text-sm">
                {t("assets.ops.roomToken")}
                <input id="ops-room-token-field" className="form-input mt-1 font-mono" value={roomToken} onChange={(e) => setRoomToken(e.target.value)} placeholder={t("assets.ops.roomTokenPlaceholder")} data-testid="ops-room-token" />
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={!roomToken || busy}
                data-testid="ops-room-lookup"
                onClick={() => void run(async () => {
                  const r = await assetsApi.roomByToken(roomToken.trim());
                  setRoomAssets((r.data.data.assets ?? []) as RoomAsset[]);
                })}
              >
                {t("assets.ops.lookupRoom")}
              </button>
            </div>
          </Step>
          {roomAssets !== null ? (
            roomAssets.length === 0 ? (
              <p className="text-sm text-neutral-500">{t("assets.ops.roomEmpty")}</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-neutral-200">
                <table className="data-table" data-testid="ops-room-assets">
                  <thead>
                    <tr>
                      <th>{t("assets.picker.tag")}</th>
                      <th>{t("assets.picker.asset")}</th>
                      <th>{t("assets.view.fieldStatus")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomAssets.map((row, i) => (
                      <tr key={row.id ?? i}>
                        <td className="font-mono text-xs">
                          {row.id ? <Link className="text-primary" href={`/assets/${row.id}`}>{row.tag_number || row.asset_code}</Link> : row.tag_number || row.asset_code}
                        </td>
                        <td>{row.name}</td>
                        <td>{row.status ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
