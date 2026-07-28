"use client";

import { useCallback, useEffect, useState } from "react";
import { stockItemsApi, stockLocationsApi, stockTransfersApi, type StockItem, type StockLocation, type StockTransfer } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StockTransfersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<StockTransfer[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");

  const load = useCallback(() => {
    stockTransfersApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load transfers"));
  }, [toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
    stockLocationsApi.list().then((res) => setLocations(res.data.data ?? [])).catch(() => undefined);
    stockItemsApi.list({ per_page: 100 }).then((res) => setItems(res.data.data ?? [])).catch(() => undefined);
  }, [load]);

  const create = async () => {
    try {
      await stockTransfersApi.create({
        from_location_id: Number(fromId),
        to_location_id: Number(toId),
        lines: [{ stock_item_id: Number(itemId), quantity: Number(qty) }],
      });
      toast("success", "Transfer drafted");
      load();
    } catch {
      toast("error", "Could not create transfer");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Store Transfers</h1>
        <p className="page-subtitle">Two-sided dispatch then receive — both sides ledgered.</p>
      </div>
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <select className="form-input" value={fromId} onChange={(e) => setFromId(e.target.value)}>
            <option value="">From…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </select>
          <select className="form-input" value={toId} onChange={(e) => setToId(e.target.value)}>
            <option value="">To…</option>
            {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
          </select>
          <select className="form-input" value={itemId} onChange={(e) => setItemId(e.target.value)}>
            <option value="">Item…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.item_code}</option>)}
          </select>
          <input type="number" min={1} className="form-input w-24" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button type="button" className="btn-primary" onClick={create}>Draft transfer</button>
        </div>
      )}
      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Reference</th>
            <th className="px-4 py-2">From → To</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">Actions</th>
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
                    try { await stockTransfersApi.dispatch(r.id); toast("success", "Dispatched"); load(); }
                    catch { toast("error", "Dispatch failed"); }
                  }}>Dispatch</button>
                )}
                {canIssue && r.status === "dispatched" && (
                  <button type="button" className="btn-secondary text-xs" onClick={async () => {
                    try { await stockTransfersApi.receive(r.id); toast("success", "Received"); load(); }
                    catch { toast("error", "Receive failed"); }
                  }}>Receive</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
