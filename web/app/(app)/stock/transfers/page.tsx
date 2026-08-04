"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
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
  const [creating, setCreating] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
    if (creating) return;
    if (fromId && toId && fromId === toId) {
      setFormError("From and to locations must be different.");
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
      toast("success", "Transfer drafted");
      load();
    } catch {
      toast("error", "Could not create transfer");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <ModulePageHeader
        title="Store Transfers"
        subtitle="Two-sided dispatch then receive — both sides ledgered."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Store Transfers" }]} />}
      />
      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-end">
            <select className="form-input disabled:opacity-60" value={fromId} onChange={(e) => setFromId(e.target.value)} disabled={creating}>
              <option value="">From…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <select className="form-input disabled:opacity-60" value={toId} onChange={(e) => setToId(e.target.value)} disabled={creating}>
              <option value="">To…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.code} — {l.name}</option>)}
            </select>
            <select className="form-input disabled:opacity-60" value={itemId} onChange={(e) => setItemId(e.target.value)} disabled={creating}>
              <option value="">Item…</option>
              {items.map((i) => <option key={i.id} value={i.id}>{i.item_code}</option>)}
            </select>
            <input type="number" min={1} className="form-input w-24 disabled:opacity-60" value={qty} onChange={(e) => setQty(e.target.value)} disabled={creating} />
            <button
              type="button"
              className="btn-primary disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={create}
              disabled={creating || !fromId || !toId || !itemId}
            >
              {creating ? "Drafting..." : "Draft transfer"}
            </button>
          </div>
          {formError && <p className="text-sm text-red-600">{formError}</p>}
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
          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-sm text-neutral-500" colSpan={4}>
                No transfers yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
