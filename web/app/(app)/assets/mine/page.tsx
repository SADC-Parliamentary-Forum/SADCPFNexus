"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { useCallback, useEffect, useState } from "react";
import { assetsApi, type Asset } from "@/lib/api";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function MyAssetsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [acting, setActing] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [declineReason, setDeclineReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await assetsApi.list({ assigned_to: "me", per_page: 100 });
      setItems(r.data.data ?? []);
    } catch {
      setError(t("assets.mine.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function accept(asset: Asset) {
    setActing(asset.id);
    setError("");
    setNotice("");
    try {
      await assetsApi.acknowledge(asset.id);
      setNotice(t("assets.mine.acknowledged"));
      await load();
    } catch {
      setError(t("assets.mine.ackFailed"));
    } finally {
      setActing(null);
    }
  }

  async function decline(asset: Asset) {
    if (declineReason.trim().length < 5) {
      setError(t("assets.mine.declineReasonRequired"));
      return;
    }
    setActing(asset.id);
    setError("");
    setNotice("");
    try {
      await assetsApi.declineAssignment(asset.id, declineReason.trim());
      setNotice(t("assets.mine.declined"));
      setDecliningId(null);
      setDeclineReason("");
      await load();
    } catch {
      setError(t("assets.mine.declineFailed"));
    } finally {
      setActing(null);
    }
  }

  async function requestReturn(asset: Asset) {
    setActing(asset.id);
    setError("");
    setNotice("");
    try {
      await assetsApi.requestReturn(asset.id);
      setNotice(t("assets.mine.returnRequested"));
      await load();
    } catch {
      setError(t("assets.mine.returnRequestFailed"));
    } finally {
      setActing(null);
    }
  }

  function isPendingAcceptance(asset: Asset): boolean {
    return asset.custody_state === "pending_acceptance"
      || (!asset.custody_state && !asset.acknowledgement_at);
  }

  function custodyLabel(asset: Asset): string {
    if (isPendingAcceptance(asset)) return t("assets.mine.pendingAcceptance");
    if (asset.custody_state === "accepted") return t("assets.mine.accepted");
    if (asset.custody_state === "pending_return") return t("assets.mine.pendingReturn");
    if (asset.acknowledgement_at) {
      return t("assets.mine.acknowledgedOn", {
        date: new Date(asset.acknowledgement_at).toLocaleDateString(),
      });
    }
    return t("assets.mine.pendingAcceptance");
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
          title="assets.mine.title"
          subtitle="assets.mine.subtitle"
          breadcrumbs={<PageBreadcrumbs items={[{ label: "assets.mine.title" }]} />}
        />
      </div>

      {notice ? (
        <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {notice}
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>{t("assets.mine.colTag")}</th>
              <th>{t("assets.mine.colName")}</th>
              <th>{t("assets.mine.colStatus")}</th>
              <th>{t("assets.mine.colCustody")}</th>
              <th className="text-right">{t("assets.mine.colActions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((asset) => (
              <tr key={asset.id}>
                <td className="font-mono text-xs">{asset.tag_number || asset.asset_code}</td>
                <td>{asset.name}</td>
                <td>{asset.status}</td>
                <td>{custodyLabel(asset)}</td>
                <td className="text-right">
                  {isPendingAcceptance(asset) && decliningId !== asset.id && (
                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        disabled={acting === asset.id}
                        onClick={() => void accept(asset)}
                        className="btn-primary text-xs"
                      >
                        {acting === asset.id ? t("common.loading") : t("assets.mine.accept")}
                      </button>
                      <button
                        type="button"
                        disabled={acting === asset.id}
                        onClick={() => {
                          setDecliningId(asset.id);
                          setDeclineReason("");
                          setError("");
                        }}
                        className="btn-secondary text-xs text-red-700"
                      >
                        {t("assets.mine.decline")}
                      </button>
                    </div>
                  )}
                  {isPendingAcceptance(asset) && decliningId === asset.id && (
                    <div className="flex flex-col items-end gap-2">
                      <label htmlFor={`decline-reason-${asset.id}`} className="sr-only">
                        {t("assets.mine.declineReasonLabel")}
                      </label>
                      <textarea
                        id={`decline-reason-${asset.id}`}
                        value={declineReason}
                        onChange={(e) => setDeclineReason(e.target.value)}
                        rows={2}
                        placeholder={t("assets.mine.declineReasonPlaceholder")}
                        className="w-64 rounded-lg border border-neutral-200 px-2 py-1 text-xs"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={acting === asset.id}
                          onClick={() => void decline(asset)}
                          className="btn-primary text-xs bg-red-600 hover:bg-red-700"
                        >
                          {acting === asset.id ? t("common.loading") : t("assets.mine.confirmDecline")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setDecliningId(null)}
                          className="btn-secondary text-xs"
                        >
                          {t("common.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                  {(asset.custody_state === "accepted"
                    || (!!asset.acknowledgement_at && asset.custody_state !== "pending_return" && !isPendingAcceptance(asset))) && (
                    <button
                      type="button"
                      disabled={acting === asset.id}
                      onClick={() => void requestReturn(asset)}
                      className="btn-secondary text-xs"
                    >
                      {acting === asset.id ? t("common.loading") : t("assets.mine.requestReturn")}
                    </button>
                  )}
                  {asset.custody_state === "pending_return" && (
                    <span className="text-xs text-amber-800">{t("assets.mine.awaitingReturnConfirm")}</span>
                  )}
                </td>
              </tr>
            ))}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EmptyState
                    icon="inventory_2"
                    title="assets.mine.empty"
                    description="assets.mine.emptyHint"
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
