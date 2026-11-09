"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockItemsApi, stockLocationsApi, stockTransfersApi, type StockItem, type StockLocation, type StockTransfer } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockTransfersPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(() => {
    stockTransfersApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", t("stock.transfers.loadFailed")));
  }, [toast, t]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
    stockLocationsApi.list().then((res) => setLocations(res.data.data ?? [])).catch(() => undefined);
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  const create = async () => {
    if (creating) return;
    if (fromId && toId && fromId === toId) {
      setFormError(t("stock.transfers.sameLocation"));
      return;
    }
    setFormError(null);
    setCreating(true);
    try {
      await stockTransfersApi.create({
        from_location_id: Number(fromId),
        to_location_id: Number(toId),
        lines: [{ stock_item_id: Number(itemId), quantity: Number(qty) }],
      });
      toast("success", t("stock.transfers.drafted"));
      load();
    } catch {
      toast("error", t("stock.transfers.createFailed"));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.transfers.title")}
        subtitle={t("stock.transfers.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.transfers.title") }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <select className="form-input disabled:opacity-60" value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={creating}>
              <option value="">{t("stock.transfers.fromPlaceholder")}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <select className="form-input disabled:opacity-60" value={toId} onChange={(e) => setToId(e.target.value)} disabled={creating}>
              <option value="">{t("stock.transfers.toPlaceholder")}</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <select className="form-input disabled:opacity-60" value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={creating}>
              <option value="">{t("stock.batches.itemPlaceholder")}</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.item_code}</option>)}
            </select>
            <input type="number" min={1} className="form-input w-24 disabled:opacity-60" value={qty} onChange={(e) => setQty(e.target.value)} disabled={creating} />
            <button
              type="button"
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={create}
              disabled={creating || !fromId || !toId || !itemId}
            >
              {creating ? t("stock.transfers.drafting") : t("stock.transfers.draft")}
            </button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">{t("stock.common.reference")}</th>
            <th className="px-4 py-2">{t("stock.common.fromTo")}</th>
            <th className="px-4 py-2">{t("stock.common.status")}</th>
            <th className="px-4 py-2">{t("stock.common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">{r.reference_number}</td>
              <td className="px-4 py-2">{r.from_location?.code} → {r.to_location?.code}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2 space-x-2">
                {canIssue && r.status === "draft" && (
                  <button type="button" className="btn-secondary text-xs" onClick={async () => {
                    try { await stockTransfersApi.dispatch(r.id); toast("success", t("stock.transfers.dispatched")); load(); }
                    catch { toast("error", t("stock.transfers.dispatchFailed")); }
                  }}>{t("stock.transfers.dispatch")}</button>
                )}
                {canIssue && r.status === "dispatched" && (
                  <button type="button" className="btn-secondary text-xs" onClick={async () => {
                    try { await stockTransfersApi.receive(r.id); toast("success", t("stock.transfers.received")); load(); }
                    catch { toast("error", t("stock.transfers.receiveFailed")); }
                  }}>{t("stock.transfers.receive")}</button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <TableEmpty colSpan={4} title={t("stock.transfers.empty")} />
          )}
        </tbody>
      </table>
    </div>
  );
}
