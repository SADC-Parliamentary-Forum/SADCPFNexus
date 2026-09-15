"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { assetQrApi, publicAssetQrApi } from "@/lib/api";
import { parseAssetQrToken } from "@/lib/assetQrToken";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function AssetScanPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [publicHit, setPublicHit] = useState<{ tag: string; name: string; notice: string } | null>(null);
  const [actions, setActions] = useState<Array<{ key: string; label: string; href: string }>>([]);
  const [assetId, setAssetId] = useState<number | null>(null);

  async function lookup(e: FormEvent) {
    e.preventDefault();
    const token = parseAssetQrToken(raw);
    if (!token) {
      setError(t("assets.scan.invalid"));
      return;
    }
    setBusy(true);
    setError("");
    setPublicHit(null);
    setActions([]);
    setAssetId(null);
    try {
      const auth = await assetQrApi.lookup(token);
      const id = auth.data.data?.id;
      if (id) {
        setAssetId(id);
        setActions(auth.data.data.allowed_actions ?? []);
        return;
      }
      throw new Error("missing id");
    } catch {
      try {
        const pub = await publicAssetQrApi.show(token);
        setPublicHit({
          tag: pub.data.data.asset_tag || pub.data.data.assetNumber || token,
          name: pub.data.data.asset_name,
          notice: pub.data.data.notice,
        });
      } catch {
        setError(t("assets.scan.notFound"));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title="assets.scan.title"
        subtitle="assets.scan.subtitle"
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("assets.scan.title") }]} />}
      />
      <form onSubmit={lookup} className="card space-y-3 p-4">
        <label className="block text-sm">
          {t("assets.scan.placeholder")}
          <input
            className="form-input mt-1"
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            placeholder={t("assets.scan.placeholder")}
            autoComplete="off"
          />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <button type="submit" className="btn-primary" disabled={busy}>
          {busy ? t("common.loading") : t("assets.scan.lookup")}
        </button>
      </form>
      {assetId && (
        <div className="card space-y-3 p-4" data-testid="scan-actions">
          <button type="button" className="btn-primary" onClick={() => router.push(`/assets/${assetId}`)}>
            {t("assets.scan.openProfile")}
          </button>
          {actions.length > 0 && (
            <div>
              <p className="text-sm font-medium">{t("assets.scan.actions")}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {actions.map((action) => (
                  <a key={action.key} href={action.href} className="btn-secondary text-xs">{action.label}</a>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {publicHit && (
        <div className="card p-4 text-sm">
          <p className="font-mono font-semibold">{publicHit.tag}</p>
          <p>{publicHit.name}</p>
          <p className="mt-2 text-neutral-600">{publicHit.notice}</p>
        </div>
      )}
    </div>
  );
}
