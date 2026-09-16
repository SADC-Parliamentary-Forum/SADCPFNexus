"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AssetQrCamera } from "@/components/assets/AssetQrCamera";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { lookupAssetFromQrRaw, type AssetScanHit } from "@/lib/assetQrLookup";
import { assetsApi, tenantUsersApi, type AssetScanBasket, type TenantUserOption } from "@/lib/api";
import { apiErrorMessage } from "@/lib/apiError";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const BASKET_KEY = "asset_scan_basket_id";

export default function AssetScanPage() {
  const { t } = useI18n();
  const router = useRouter();
  const lookupSeq = useRef(0);
  const busyRef = useRef(false);
  const [raw, setRaw] = useState("");
  const [nfc, setNfc] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [hit, setHit] = useState<AssetScanHit | null>(null);
  const [cameraActive, setCameraActive] = useState(true);
  const [restartKey, setRestartKey] = useState(0);
  const [basket, setBasket] = useState<AssetScanBasket | null>(null);
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [toUserId, setToUserId] = useState("");

  useEffect(() => {
    tenantUsersApi.list().then((r) => setUsers(r.data.data ?? [])).catch(() => setUsers([]));
    const stored = Number(sessionStorage.getItem(BASKET_KEY) || 0);
    if (stored) {
      assetsApi.getScanBasket(stored).then((r) => {
        if (r.data.data.status === "open") setBasket(r.data.data);
        else sessionStorage.removeItem(BASKET_KEY);
      }).catch(() => sessionStorage.removeItem(BASKET_KEY));
    }
  }, []);

  async function ensureBasket(): Promise<number> {
    if (basket?.id && basket.status === "open") return basket.id;
    const created = await assetsApi.createScanBasket();
    sessionStorage.setItem(BASKET_KEY, String(created.data.data.id));
    setBasket(created.data.data);
    return created.data.data.id;
  }

  async function addToBasket(payload: { token?: string; nfc_uid?: string }) {
    setError("");
    try {
      const id = await ensureBasket();
      const updated = await assetsApi.addScanBasketItem(id, payload);
      setBasket(updated.data.data);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.scan.notFound")));
    }
  }

  const runLookup = useCallback(async (value: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const seq = ++lookupSeq.current;
    setBusy(true);
    setError("");
    try {
      const result = await lookupAssetFromQrRaw(value);
      if (seq !== lookupSeq.current) return;
      if (!result.ok) {
        setError(t(result.reason === "invalid" ? "assets.scan.invalid" : "assets.scan.notFound"));
        return;
      }
      setRaw(result.token);
      setHit(result.hit);
      setCameraActive(false);
    } finally {
      if (seq === lookupSeq.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  }, [t]);

  function onManual(e: FormEvent) {
    e.preventDefault();
    if (nfc.trim()) {
      void addToBasket({ nfc_uid: nfc.trim() });
      return;
    }
    void runLookup(raw);
  }

  function scanAnother() {
    lookupSeq.current += 1;
    busyRef.current = false;
    setHit(null);
    setError("");
    setRaw("");
    setNfc("");
    setBusy(false);
    setCameraActive(true);
    setRestartKey((key) => key + 1);
  }

  async function startHandover() {
    if (!basket?.id || !toUserId) return;
    setError("");
    try {
      const started = await assetsApi.startScanBasketHandover(basket.id, {
        type: "issue",
        custody_target_type: "person",
        to_user_id: Number(toUserId),
      });
      sessionStorage.removeItem(BASKET_KEY);
      router.push(`/assets/handovers/${started.data.data.id}`);
    } catch (err) {
      setError(apiErrorMessage(err, t("assets.assignFailed")));
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.scan.title"
        subtitle="assets.scan.subtitle"
        breadcrumbs={(
          <PageBreadcrumbs
            items={[
              { label: "nav.assets", href: "/assets" },
              { label: "assets.scan.title" },
            ]}
          />
        )}
      />

      <div className="grid gap-5 lg:grid-cols-5">
        <section className="card space-y-3 p-5 lg:col-span-3" aria-labelledby="scan-camera-heading">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="scan-camera-heading" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t("assets.scan.cameraTitle")}
              </h2>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t("assets.scan.cameraHint")}</p>
            </div>
            {busy && (
              <span className="text-xs font-medium uppercase tracking-wide text-primary-700">{t("assets.scan.decoding")}</span>
            )}
          </div>
          <AssetQrCamera
            active={cameraActive}
            scanning={cameraActive && !busy}
            restartKey={restartKey}
            onDetect={runLookup}
          />
        </section>

        <section className="card space-y-4 p-5 lg:col-span-2" aria-labelledby="scan-manual-heading">
          <div>
            <h2 id="scan-manual-heading" className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t("assets.scan.manualTitle")}
            </h2>
            <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">{t("assets.scan.manualHint")}</p>
          </div>
          <form onSubmit={onManual} className="space-y-3" data-testid="scan-manual-form">
            <label htmlFor="scan-token-input" className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {t("assets.scan.tokenLabel")}
            </label>
            <input
              id="scan-token-input"
              data-testid="scan-token-input"
              className="form-input font-mono"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t("assets.scan.placeholder")}
              autoComplete="off"
              spellCheck={false}
              inputMode="url"
            />
            <label htmlFor="scan-nfc-input" className="block text-sm font-medium text-neutral-800 dark:text-neutral-200">
              {t("assets.scan.nfc")}
            </label>
            <input
              id="scan-nfc-input"
              data-testid="scan-nfc-input"
              className="form-input font-mono"
              value={nfc}
              onChange={(e) => setNfc(e.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            {error && <p role="alert" className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            <button type="submit" className="btn-primary w-full justify-center" disabled={busy} data-testid="scan-lookup">
              {busy ? t("common.loading") : t("assets.scan.lookup")}
            </button>
          </form>
        </section>
      </div>

      {hit?.kind === "register" && (
        <section className="card space-y-4 p-5" data-testid="scan-actions" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">{t("assets.scan.found")}</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{hit.name}</h2>
              <p className="font-mono text-sm text-neutral-600 dark:text-neutral-400">{hit.tag}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={scanAnother}>
              {t("assets.scan.scanAnother")}
            </button>
          </div>
          <dl className="grid gap-3 sm:grid-cols-3">
            {hit.status && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("assets.view.fieldStatus")}</dt>
                <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{hit.status}</dd>
              </div>
            )}
            {hit.location && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("assets.scan.location")}</dt>
                <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{hit.location}</dd>
              </div>
            )}
            {hit.custodian && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("assets.handover.inCustodyOf")}</dt>
                <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{hit.custodian}</dd>
              </div>
            )}
            {hit.condition && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">{t("assets.scan.condition")}</dt>
                <dd className="mt-1 text-sm text-neutral-900 dark:text-neutral-100">{hit.condition}</dd>
              </div>
            )}
          </dl>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" onClick={() => router.push(`/assets/${hit.id}`)}>
              {t("assets.scan.openProfile")}
            </button>
            <button type="button" className="btn-secondary" onClick={() => void addToBasket({ token: raw })}>
              {t("assets.scan.addBasket")}
            </button>
            {hit.actions.map((action) => (
              <a key={action.key} href={action.href} className="btn-secondary text-sm">{action.label}</a>
            ))}
          </div>
        </section>
      )}

      {hit?.kind === "public" && (
        <section className="card space-y-3 p-5" data-testid="scan-public" aria-live="polite">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("assets.scan.publicOnly")}</p>
              <h2 className="mt-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">{hit.name}</h2>
              <p className="font-mono text-sm text-neutral-600">{hit.tag}</p>
            </div>
            <button type="button" className="btn-secondary" onClick={scanAnother}>
              {t("assets.scan.scanAnother")}
            </button>
          </div>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">{hit.notice}</p>
        </section>
      )}

      <section className="card space-y-3 p-5" aria-labelledby="scan-basket-heading">
        <h2 id="scan-basket-heading" className="text-base font-semibold">{t("assets.scan.basket")}</h2>
        <p className="text-sm text-neutral-600">{t("assets.scan.basketHint")}</p>
        {(basket?.items ?? []).length === 0 ? (
          <p className="text-sm text-neutral-500">{t("assets.kits.empty")}</p>
        ) : (
          <ul className="text-sm space-y-1">
            {basket?.items.map((item) => (
              <li key={item.id} className="font-mono text-xs">{item.tag_number} — {item.name}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2">
          <select className="form-input" value={toUserId} onChange={(e) => setToUserId(e.target.value)}>
            <option value="">{t("assets.handover.inCustodyOf")}</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
          <button
            type="button"
            className="btn-primary"
            disabled={!basket?.items?.length || !toUserId}
            onClick={() => void startHandover()}
          >
            {t("assets.scan.startBasket")}
          </button>
        </div>
      </section>
    </div>
  );
}
