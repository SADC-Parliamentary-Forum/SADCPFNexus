"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import api, { assetQrApi, assetUnregisteredFindsApi, assetVerificationApi } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { AssetQrCamera } from "@/components/assets/AssetQrCamera";

type Campaign = { id: number; name: string; status: string; starts_on: string; ends_on?: string };
type Counts = Record<string, number | Record<string, number>>;
type Find = {
  id: number;
  description: string;
  status: string;
  found_location?: string | null;
  make?: string | null;
  model?: string | null;
  serial_number?: string | null;
};
type Gps = { lat: number; lng: number } | null;

function readFilesAsPhotos(files: FileList | null): Promise<Array<{ name: string; content_type: string; data_url: string }>> {
  const list = Array.from(files ?? []).slice(0, 4);
  return Promise.all(list.map((file) => new Promise<{ name: string; content_type: string; data_url: string }>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({
      name: file.name,
      content_type: file.type || "image/jpeg",
      data_url: String(reader.result ?? ""),
    });
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  })));
}

export default function AssetVerificationPage() {
  const { t } = useI18n();
  const { prompt } = useConfirm();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [startsOn, setStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [scope, setScope] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [finds, setFinds] = useState<Find[]>([]);
  const [findForm, setFindForm] = useState({ description: "", make: "", model: "", serial_number: "", found_location: "", notes: "" });
  const [findPhotos, setFindPhotos] = useState<FileList | null>(null);
  const [scanToken, setScanToken] = useState("");
  const [cameraActive, setCameraActive] = useState(true);
  const [restartKey, setRestartKey] = useState(0);
  const [gps, setGps] = useState<Gps>(null);
  const [verifyPhotos, setVerifyPhotos] = useState<FileList | null>(null);
  const gpsAsked = useRef(false);
  const [scanned, setScanned] = useState<{
    id: number;
    asset_tag: string;
    name: string;
    location?: string | null;
    custodian?: string | null;
    condition?: string | null;
  } | null>(null);

  const active = campaigns.find((c) => c.id === activeId);

  async function load(campaignId?: number) {
    const r = await api.get<{ data: Campaign[] }>("/assets-meta/verification-campaigns");
    const list = Array.isArray(r.data.data) ? r.data.data : ((r.data as { data?: Campaign[] }).data ?? []);
    setCampaigns(list);
    const selected = campaignId ?? activeId ?? list[0]?.id;
    if (selected) {
      setActiveId(selected);
      const dash = await api.get<{ data: { counts: Counts } }>(`/assets-meta/verification-campaigns/${selected}/dashboard`);
      setCounts(dash.data.data.counts);
    }
    const found = await assetUnregisteredFindsApi.list();
    setFinds(((found.data as { data?: Find[] }).data ?? []) as Find[]);
  }

  useEffect(() => { load().catch(() => setCampaigns([])); }, []);

  useEffect(() => {
    if (gpsAsked.current || typeof navigator === "undefined" || !navigator.geolocation) return;
    gpsAsked.current = true;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGps(null),
      { enableHighAccuracy: false, timeout: 8000 },
    );
  }, []);

  async function createCampaign(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setMsg(null);
    setErrorMsg(null);
    try {
      await api.post("/assets-meta/verification-campaigns", {
        name,
        starts_on: startsOn,
        scope: scope.trim() ? { note: scope.trim() } : null,
      });
      setName("");
      setMsg(t("common.create"));
      await load();
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: string } } };
      setErrorMsg(ax?.response?.data?.message ?? t("common.error"));
    } finally {
      setCreating(false);
    }
  }

  async function closeCampaign() {
    if (!activeId || active?.status === "closed") return;
    setErrorMsg(null);
    try {
      await assetVerificationApi.close(activeId);
      setMsg(t("assets.verify.closed"));
      await load(activeId);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: string } } };
      setErrorMsg(ax?.response?.data?.message ?? t("common.error"));
    }
  }

  async function recordFind(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    try {
      const photos = await readFilesAsPhotos(findPhotos).catch(() => []);
      await assetUnregisteredFindsApi.create({
        description: findForm.description,
        make: findForm.make || null,
        model: findForm.model || null,
        serial_number: findForm.serial_number || null,
        found_location: findForm.found_location || null,
        notes: findForm.notes || null,
        photos: photos.length ? photos : null,
        campaign_id: activeId ?? campaigns[0]?.id,
      });
      setFindForm({ description: "", make: "", model: "", serial_number: "", found_location: "", notes: "" });
      setFindPhotos(null);
      await load(activeId ?? undefined);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: string } } };
      setErrorMsg(ax?.response?.data?.message ?? t("common.error"));
    }
  }

  const applyLookup = useCallback(async (rawValue: string) => {
    setErrorMsg(null);
    try {
      const raw = rawValue.trim();
      let token = raw;
      try {
        const parsed = new URL(raw);
        const parts = parsed.pathname.split("/").filter(Boolean);
        const idx = parts.lastIndexOf("a");
        if (idx >= 0 && parts[idx + 1]) token = decodeURIComponent(parts[idx + 1]);
      } catch {
        const match = raw.match(/\/a\/([^/?#]+)/);
        if (match) token = decodeURIComponent(match[1]);
      }
      const r = await assetQrApi.lookup(token);
      const row = r.data.data;
      setScanToken(token);
      setScanned({
        id: row.id,
        asset_tag: row.asset_tag,
        name: row.name,
        location: row.location?.name ?? null,
        custodian: row.custodian?.name ?? null,
        condition: row.condition ?? null,
      });
      setCameraActive(false);
    } catch {
      setScanned(null);
      setErrorMsg(t("assets.public.notFound"));
    }
  }, [t]);

  async function scanTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    await applyLookup(scanToken);
  }

  async function recordScanResult(result: "verified" | "missing" | "wrong_location" | "wrong_custodian" | "condition_changed" | "relocated" | "damaged") {
    if (!activeId || !scanned) return;
    setErrorMsg(null);
    try {
      const photos = await readFilesAsPhotos(verifyPhotos).catch(() => []);
      await assetVerificationApi.record(activeId, {
        asset_id: scanned.id,
        result,
        verification_method: "qr",
        mismatch_types: result === "verified" ? null : [result],
        gps_lat: gps?.lat ?? null,
        gps_lng: gps?.lng ?? null,
        photos: photos.length ? photos : null,
      });
      setMsg(t("assets.verify.recordResult"));
      setScanToken("");
      setScanned(null);
      setVerifyPhotos(null);
      setCameraActive(true);
      setRestartKey((k) => k + 1);
      await load(activeId);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: string } } };
      setErrorMsg(ax?.response?.data?.message ?? t("common.error"));
    }
  }

  async function promoteFind(find: Find) {
    const tag = (await prompt({
      title: "assets.verify.promoteTitle",
      label: "assets.verify.promoteTag",
      required: true,
    }))?.trim();
    if (!tag) return;
    await assetUnregisteredFindsApi.promote(find.id, { asset_tag: tag, name: find.description });
    await load(activeId ?? undefined);
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title={t("assets.verify.title")}
          subtitle={t("assets.verify.subtitle")}
          breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.verify.title") }]} />}
        />
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {errorMsg && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{errorMsg}</div>}
      {counts && (
        <div className="grid gap-3 sm:grid-cols-4">
          {Object.entries(counts).filter((entry): entry is [string, number] => typeof entry[1] === "number").map(([k, v]) => (
            <div key={k} className="card p-3">
              <div className="text-xs text-neutral-500">{t(`assets.verify.count.${k}`)}</div>
              <div className="text-lg font-semibold">{v}</div>
            </div>
          ))}
        </div>
      )}
      <form onSubmit={createCampaign} className="card" style={{ padding: "1rem", marginBottom: "1.5rem", display: "flex", gap: 12, flexWrap: "wrap" }}>
        <input className="input" placeholder={t("assets.verify.title")} value={name} onChange={(e) => setName(e.target.value)} required />
        <input className="input" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} required />
        <input className="input" placeholder={t("assets.verify.scopeHint")} value={scope} onChange={(e) => setScope(e.target.value)} />
        <Button type="submit" disabled={creating}>{creating ? t("common.loading") : t("common.create")}</Button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white shadow-card dark:border-neutral-700 dark:bg-neutral-900">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("assets.verify.colName")}</th>
              <th>{t("assets.verify.colStatus")}</th>
              <th>{t("assets.verify.colStarts")}</th>
              <th>{t("assets.verify.colEnds")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className={activeId === c.id ? "bg-primary/5" : undefined}>
                <td>
                  <button type="button" className="text-left font-medium" onClick={() => load(c.id)}>{c.name}</button>
                </td>
                <td>{t(`assets.verify.status.${c.status}`) === `assets.verify.status.${c.status}` ? c.status : t(`assets.verify.status.${c.status}`)}</td>
                <td>{c.starts_on}</td>
                <td>{c.ends_on ?? "—"}</td>
                <td>
                  {activeId === c.id && c.status === "open" && (
                    <Button type="button" size="sm" variant="secondary" onClick={() => void closeCampaign()} data-testid="assets-verify-close">
                      {t("assets.verify.closeCampaign")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
            {campaigns.length === 0 && <tr><td colSpan={5}>{t("common.noResults")}</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold">{t("assets.verify.camera")}</h2>
          <p className="text-xs text-neutral-500">{gps ? t("assets.verify.gpsOn") : t("assets.verify.gpsOff")}</p>
          <AssetQrCamera
            active={cameraActive && !scanned}
            scanning={!scanned}
            restartKey={restartKey}
            onDetect={(raw) => { void applyLookup(raw); }}
          />
        </div>
        <form onSubmit={scanTokenSubmit} className="card flex flex-col gap-2 p-4">
          <label htmlFor="assets-verification-scan-token" className="text-sm">{t("assets.verify.scanToken")}
            <input id="assets-verification-scan-token" className="input mt-1" value={scanToken} onChange={(e) => setScanToken(e.target.value)} required />
          </label>
          <Button type="submit">{t("assets.verify.scan")}</Button>
        </form>
      </div>
      {scanned && (
        <div className="card space-y-3 p-4 text-sm">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono">{scanned.asset_tag}</span>
            <span>{scanned.name}</span>
            <Link href={`/assets/${scanned.id}`} className="text-primary font-semibold" data-testid="assets-verify-open-asset">
              {t("assets.verify.openAsset")}
            </Link>
          </div>
          <p>{t("assets.verify.expectedLocation")}: {scanned.location ?? "—"}</p>
          <p>{t("assets.verify.expectedCustodian")}: {scanned.custodian ?? "—"}</p>
          <p>{t("assets.verify.expectedCondition")}: {scanned.condition ?? "—"}</p>
          <label className="block text-sm">{t("assets.verify.photos")}
            <input className="input mt-1" type="file" accept="image/*" multiple onChange={(e) => setVerifyPhotos(e.target.files)} />
          </label>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => recordScanResult("verified")}>{t("assets.verify.action.verified")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("wrong_location")}>{t("assets.verify.action.wrongLocation")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("relocated")} data-testid="assets-verify-relocated">{t("assets.verify.action.relocated")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("wrong_custodian")}>{t("assets.verify.action.wrongCustodian")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("condition_changed")}>{t("assets.verify.action.conditionChanged")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("damaged")}>{t("assets.verify.action.damaged")}</Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => recordScanResult("missing")}>{t("assets.verify.action.missing")}</Button>
          </div>
        </div>
      )}

      <h2 className="text-sm font-semibold">{t("assets.verify.unregistered")}</h2>
      <form onSubmit={recordFind} className="card grid gap-2 p-4 sm:grid-cols-2">
        <input className="input sm:col-span-2" value={findForm.description} onChange={(e) => setFindForm({ ...findForm, description: e.target.value })} placeholder={t("assets.verify.recordFind")} required />
        <input className="input" value={findForm.make} onChange={(e) => setFindForm({ ...findForm, make: e.target.value })} placeholder={t("assets.verify.findMake")} />
        <input className="input" value={findForm.model} onChange={(e) => setFindForm({ ...findForm, model: e.target.value })} placeholder={t("assets.verify.findModel")} />
        <input className="input" value={findForm.serial_number} onChange={(e) => setFindForm({ ...findForm, serial_number: e.target.value })} placeholder={t("assets.verify.findSerial")} />
        <input className="input" value={findForm.found_location} onChange={(e) => setFindForm({ ...findForm, found_location: e.target.value })} placeholder={t("assets.verify.findLocation")} />
        <textarea className="input sm:col-span-2" rows={2} value={findForm.notes} onChange={(e) => setFindForm({ ...findForm, notes: e.target.value })} placeholder={t("assets.verify.findNotes")} />
        <label className="text-sm sm:col-span-2">{t("assets.verify.photos")}
          <input className="input mt-1" type="file" accept="image/*" multiple onChange={(e) => setFindPhotos(e.target.files)} />
        </label>
        <div>
          <Button type="submit">{t("assets.verify.recordFind")}</Button>
        </div>
      </form>
      <ul className="card space-y-2 p-4 text-sm">
        {finds.map((f) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2">
            <span>{f.description}{f.serial_number ? ` · ${f.serial_number}` : ""}{f.found_location ? ` · ${f.found_location}` : ""} — {f.status}</span>
            {f.status !== "promoted" && (
              <Button type="button" size="sm" variant="secondary" onClick={() => promoteFind(f)}>{t("assets.verify.promote")}</Button>
            )}
          </li>
        ))}
        {finds.length === 0 && <li>{t("common.noResults")}</li>}
      </ul>
    </div>
  );
}
