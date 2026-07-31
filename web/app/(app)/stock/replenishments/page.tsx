"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockItemsApi, stockReplenishmentsApi, type StockItem, type StockReplenishmentRequest } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockReplenishmentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockReplenishmentRequest[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("10");

  const load = useCallback(() => {
    stockReplenishmentsApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load replenishments"));
  }, [toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
    stockItemsApi.list({ per_page: 100, low_stock: 1 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Replenishment Requests"
        subtitle="Stores → Procurement signal to buy before stockouts. Does not create budget commitments."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Replenishment Requests" }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <select className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Low-stock item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
          <input type="number" min={1} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button type="button" className="btn-primary" onClick={async () => {
            try {
              await stockReplenishmentsApi.create({ stock_item_id: Number(itemId), quantity_requested: Number(qty) });
              toast("success", "Replenishment request created");
              load();
            } catch {
              toast("error", "Could not create replenishment");
            }
          }}>Request replenishment</button>
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Requested</th>
            <th className="px-4 py-2">Suggested</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">{r.reference_number}</td>
              <td className="px-4 py-2">{r.item?.name ?? "—"}</td>
              <td className="px-4 py-2">{r.quantity_requested}</td>
              <td className="px-4 py-2">{r.quantity_suggested}</td>
              <td className="px-4 py-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
