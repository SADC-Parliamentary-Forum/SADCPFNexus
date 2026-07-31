"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stockItemsApi, stockRequestsApi, type StockItem, type StockRequest } from "@/lib/api";
import { canIssueStock, canManageStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockRequestsPage() {
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
      .catch(() => toast("error", "Failed to load stock requests"));
  }, [toast]);

  useEffect(() => {
    const user = getStoredUser();
    setCanManage(canManageStock(user) || canIssueStock(user));
    load();
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  const create = async () => {
    if (!itemId || !qty) {
      toast("error", "Select an item and quantity");
      return;
    }
    try {
      await stockRequestsApi.create({
        purpose: purpose || undefined,
        submit: true,
        lines: [{ stock_item_id: Number(itemId), quantity_requested: Number(qty) }],
      });
      toast("success", "Request submitted");
      setPurpose("");
      load();
    } catch {
      toast("error", "Could not create request");
    }
  };

  const approve = async (id: number) => {
    try {
      await stockRequestsApi.approve(id);
      toast("success", "Approved & reserved");
      load();
    } catch {
      toast("error", "Approve failed (check available stock)");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Stock Requests"
        subtitle="Request → approve (reserves) → issue against voucher."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Stock Requests" }]} />}
      />

      {canManage && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Item</label>
            <select className="form-input min-w-[220px]" value={itemId} onChange={(e) => setItemId(e.target.value)}>
              <option value="">Select…</option>
              {items.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.item_code} — {i.name} (avail {i.available_quantity ?? i.current_balance})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Qty</label>
            <input type="number" min={1} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Purpose</label>
            <input className="form-input" value={purpose} onChange={(e) => setPurpose(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>Submit request</button>
        </div>
      )}

      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2">Purpose</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t border-neutral-100">
              <td className="px-4 py-2">
                <Link className="text-primary-700 hover:underline" href={`/stock/requests`}>{r.reference_number}</Link>
              </td>
              <td className="px-4 py-2">{r.purpose ?? "—"}</td>
              <td className="px-4 py-2">{r.status}</td>
              <td className="px-4 py-2 space-x-2">
                {canManage && r.status === "submitted" && (
                  <button type="button" className="btn-secondary text-xs" onClick={() => approve(r.id)}>Approve</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
