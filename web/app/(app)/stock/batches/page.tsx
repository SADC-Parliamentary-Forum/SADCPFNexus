"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import { stockBatchesApi, stockItemsApi, type StockItem } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockBatchesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [itemId, setItemId] = useState("");
  const [batchNumber, setBatchNumber] = useState("");
  const [expiry, setExpiry] = useState("");
  const [qty, setQty] = useState("0");

  const load = useCallback(() => {
    stockBatchesApi.list({ per_page: 100 })
      .then((res) => setRows((res.data as { data?: Array<Record<string, unknown>> }).data ?? []))
      .catch(() => toast("error", "Failed to load batches"));
  }, [toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Batches / Expiry"
        subtitle="Optional lot tracking. Expired batches are not issuable."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Batches / Expiry" }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <select className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code}</option>)}
          </select>
          <input className="form-input" placeholder="Batch #" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />
          <input type="date" className="form-input" value={expiry} onChange={(e) => setExpiry(e.target.value)} />
          <input type="number" min={0} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button type="button" className="btn-primary" onClick={async () => {
            try {
              await stockBatchesApi.create({
                stock_item_id: Number(itemId),
                batch_number: batchNumber,
                expiry_date: expiry || null,
                quantity: Number(qty),
              });
              toast("success", "Batch registered");
              load();
            } catch {
              toast("error", "Could not register batch");
            }
          }}>Add batch</button>
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">Batch</th>
            <th className="px-4 py-2">Expiry</th>
            <th className="px-4 py-2">Qty</th>
            <th className="px-4 py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r.id)} className="border-t border-neutral-100">
              <td className="px-4 py-2">{(r.item as { name?: string } | undefined)?.name ?? "—"}</td>
              <td className="px-4 py-2">{String(r.batch_number)}</td>
              <td className="px-4 py-2">{String(r.expiry_date ?? "—")}</td>
              <td className="px-4 py-2">{String(r.quantity)}</td>
              <td className="px-4 py-2">{String(r.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
