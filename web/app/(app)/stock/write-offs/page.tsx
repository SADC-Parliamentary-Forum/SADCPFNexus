"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockItemsApi, stockWriteOffsApi, type StockItem, type StockWriteOff } from "@/lib/api";
import { canIssueStock, canManageStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockWriteOffsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockWriteOff[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("damaged");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    stockWriteOffsApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", t("stock.writeOffs.loadFailed")));
  }, [toast, t]);

  useEffect(() => {
    const user = getStoredUser();
    setCanIssue(canIssueStock(user));
    setCanApprove(canManageStock(user));
    load();
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.writeOffs.title")}
        subtitle={t("stock.writeOffs.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.writeOffs.title") }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <select className="form-input disabled:opacity-60" value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={creating}>
            <option value="">{t("stock.batches.itemPlaceholder")}</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
          <input type="number" min={1} className="form-input w-24 disabled:opacity-60" value={qty} onChange={(e) => setQty(e.target.value)} disabled={creating} />
          <select className="form-input disabled:opacity-60" value={reason} onChange={(e) => setReason(e.target.value)} disabled={creating}>
            <option value="damaged">{t("stock.returns.conditionDamaged")}</option>
            <option value="expired">{t("stock.returns.conditionExpired")}</option>
            <option value="shortage">{t("stock.writeOffs.reasonShortage")}</option>
            <option value="other">{t("stock.writeOffs.reasonOther")}</option>
          </select>
          <button
            type="button"
            className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={creating || !itemId}
            onClick={async () => {
              if (creating) return;
              setCreating(true);
              try {
                await stockWriteOffsApi.create({
                  stock_item_id: Number(itemId),
                  quantity: Number(qty),
                  reason_code: reason,
                });
                toast("success", t("stock.writeOffs.submitted"));
                load();
              } catch {
                toast("error", t("stock.writeOffs.submitFailed"));
              } finally {
                setCreating(false);
              }
            }}
          >
            {creating ? t("stock.writeOffs.submitting") : t("stock.writeOffs.request")}
          </button>
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">{t("stock.common.reference")}</th>
            <th className="px-4 py-2">{t("stock.common.item")}</th>
            <th className="px-4 py-2">{t("stock.common.qty")}</th>
            <th className="px-4 py-2">{t("stock.common.reason")}</th>
            <th className="px-4 py-2">{t("stock.common.status")}</th>
            <th className="px-4 py-2">{t("stock.common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">{r.reference_number}</td>
              <td className="px-4 py-2">{r.item?.name ?? "—"}</td>
              <td className="px-4 py-2">{r.quantity}</td>
              <td className="px-4 py-2">{r.reason_code}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2">
                {canApprove && r.status === "pending" && (
                  <button type="button" className="btn-secondary text-xs" onClick={async () => {
                    try { await stockWriteOffsApi.approve(r.id); toast("success", t("stock.writeOffs.approved")); load(); }
                    catch { toast("error", t("stock.writeOffs.approveFailed")); }
                  }}>{t("common.approve")}</button>
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <TableEmpty colSpan={6} title={t("stock.writeOffs.empty")} />
          )}
        </tbody>
      </table>
    </div>
  );
}
