"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockItemsApi, stockReturnsApi, type StockItem } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockReturnsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [condition, setCondition] = useState("good");

  const load = useCallback(() => {
    stockReturnsApi.list({ per_page: 50 })
      .then((res) => setRows((res.data as { data?: Array<Record<string, unknown>> }).data ?? []))
      .catch(() => toast("error", "Failed to load returns"));
  }, [toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  const create = async () => {
    try {
      await stockReturnsApi.create({
        stock_item_id: Number(itemId),
        quantity: Number(qty),
        condition,
        return_date: new Date().toISOString().slice(0, 10),
      });
      toast("success", "Return recorded");
      load();
    } catch {
      toast("error", "Return failed");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Stock Returns"
        subtitle="Returned stock is ledgered in; damaged/expired returns go to quarantine."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock Returns" }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <select className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code} — {i.name}</option>)}
          </select>
          <input type="number" min={1} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          <select className="form-input" value={condition} onChange={(e) => setCondition(e.target.value)}>
            <option value="good">Good</option>
            <option value="damaged">Damaged</option>
            <option value="expired">Expired</option>
          </select>
          <button type="button" className="btn-primary" onClick={create}>Record return</button>
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Qty</th>
            <th className="px-4 py-2">Condition</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="border-t border-neutral-100">
              <td className="px-4 py-2">{String(r.reference_number)}</td>
              <td className="px-4 py-2">{(r.item as { name?: string } | undefined)?.name ?? "—"}</td>
              <td className="px-4 py-2">{String(r.quantity)}</td>
              <td className="px-4 py-2">{String(r.condition)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
