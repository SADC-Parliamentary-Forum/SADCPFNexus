"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockItemsApi, stockRequestsApi, type StockItem, type StockRequest } from "@/lib/api";
import { canIssueStock, canManageStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";
import { useI18n } from "@/lib/i18n/LocaleProvider";

export default function StockRequestsPage() {
  const { t } = useI18n();
  const { toast } = useToast();
  const [rows, setRows] = useState<StockRequest[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [purpose, setPurpose] = useState("");

  const load = useCallback(() => {
    stockRequestsApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", t("stock.requests.loadFailed")));
  }, [toast, t]);

  useEffect(() => {
    const user = getStoredUser();
    setCanManage(canManageStock(user) || canIssueStock(user));
    load();
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  const create = async () => {
    if (!itemId || !qty) {
      toast("error", t("stock.requests.selectItemQty"));
      return;
    }
    try {
      await stockRequestsApi.create({
        purpose: purpose || undefined,
        submit: true,
        lines: [{ stock_item_id: Number(itemId), quantity_requested: Number(qty) }],
      });
      toast("success", t("stock.requests.submitted"));
      setPurpose("");
      load();
    } catch {
      toast("error", t("stock.requests.createFailed"));
    }
  };

  const approve = async (id: number) => {
    try {
      await stockRequestsApi.approve(id);
      toast("success", t("stock.requests.approved"));
      load();
    } catch {
      toast("error", t("stock.requests.approveFailed"));
    }
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={t("stock.requests.title")}
        subtitle={t("stock.requests.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.requests.title") }]} />}
      />

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label htmlFor="stock-requests-item" className="block text-xs font-semibold mb-1">{t("stock.common.item")}</label>
            <select id="stock-requests-item" className="form-input min-w-[220px]" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">{t("people.common.select")}</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {t("stock.requests.itemOption", { code: i.item_code, name: i.name, available: i.available_quantity ?? i.current_balance })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="stock-requests-qty" className="block text-xs font-semibold mb-1">{t("stock.common.qty")}</label>
            <input id="stock-requests-qty" type="number" min={1} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label htmlFor="stock-requests-purpose" className="block text-xs font-semibold mb-1">{t("stock.common.purpose")}</label>
            <input id="stock-requests-purpose" className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>{t("stock.requests.submit")}</button>
        </div>
      )}

      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">{t("stock.common.reference")}</th>
            <th className="px-4 py-2">{t("stock.common.purpose")}</th>
            <th className="px-4 py-2">{t("stock.common.status")}</th>
            <th className="px-4 py-2">{t("stock.common.actions")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">
                <Link className="btn-secondary text-xs py-1 px-2" href={`/stock/requests`}>{r.reference_number}</Link>
              </td>
              <td className="px-4 py-2">{r.purpose ?? "—"}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2 space-x-2">
                {canManage && r.status === "submitted" && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => approve(r.id)}>{t("common.approve")}</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
