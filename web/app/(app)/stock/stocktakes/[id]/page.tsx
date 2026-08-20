"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { stocktakesApi, type Stocktake, type StocktakeLine } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

const OFFLINE_QUEUE_KEY = "sadcpf.stocktake.offlineQueue";

type BrowserQueueLine = {
  client_line_key?: string;
  stock_item_id?: number;
  barcode?: string;
  counted_qty: number;
};

function readBrowserQueue(): BrowserQueueLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as BrowserQueueLine[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export default function StocktakeDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const { toast } = useToast();
  const [stocktake, setStocktake] = useState<Stocktake | null>(null);
  const [counts, setCounts] = useState<Record<number, string>>({});
  const [canIssue, setCanIssue] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    stocktakesApi.get(id)
      .then((res) => {
        const st = res.data.data;
        setStocktake(st);
        const map: Record<number, string> = {};
        (st.lines ?? []).forEach((l: StocktakeLine) => {
          map[l.id] = l.counted_qty != null ? String(l.counted_qty) : "";
        });
        setCounts(map);
      })
      .catch(() => toast("error", "Failed to load stocktake"));
  }, [id, toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
  }, [load]);

  const editable = stocktake && (stocktake.status === "draft" || stocktake.status === "in_progress");

  const saveCounts = async () => {
    if (!stocktake) return;
    setSaving(true);
    try {
      const lines = (stocktake.lines ?? []).map((l) => ({
        id: l.id,
        counted_qty: counts[l.id] === "" ? null : Number(counts[l.id]),
      }));
      const res = await stocktakesApi.updateCounts(stocktake.id, lines);
      setStocktake(res.data.data);
      toast("success", "Counts saved");
    } catch {
      toast("error", "Failed to save counts");
    } finally {
      setSaving(false);
    }
  };

  const complete = async () => {
    if (!stocktake) return;
    setSaving(true);
    try {
      await saveCounts();
      const res = await stocktakesApi.complete(stocktake.id);
      setStocktake(res.data.data);
      toast(
        "success",
        res.data.data.status === "pending_approval"
          ? "Submitted — variance approval required"
          : "Stocktake completed — no variances"
      );
    } catch {
      toast("error", "Complete failed — ensure every line has a count");
    } finally {
      setSaving(false);
    }
  };

  const approveVariances = async () => {
    if (!stocktake) return;
    setSaving(true);
    try {
      const res = await stocktakesApi.approveVariances(stocktake.id);
      setStocktake(res.data.data);
      toast("success", "Variances approved and posted to ledger");
    } catch {
      toast("error", "Variance approval failed");
    } finally {
      setSaving(false);
    }
  };

  const [showSyncModal, setShowSyncModal] = useState(false);
  const [offlineInput, setOfflineInput] = useState("");
  const [syncConflicts, setSyncConflicts] = useState<Array<{ line_id: number; server_counted_qty: number; incoming_counted_qty: number }>>([]);

  const applyLines = async (
    lines: Array<{ client_line_key?: string; stock_item_id?: number; barcode?: string; counted_qty: number }>,
    force = false,
    clearBrowserQueue = false,
  ) => {
    if (!stocktake || lines.length === 0) return;
    setSaving(true);
    try {
      const res = await stocktakesApi.syncOffline(stocktake.id, lines, force);
      const data = res.data.data;
      if (data.conflicts && data.conflicts.length > 0 && !force) {
        setSyncConflicts(data.conflicts);
        setShowSyncModal(true);
        toast("warning", `${data.conflicts.length} count conflicts detected! Confirm overwrite.`);
      } else {
        setStocktake(data.stocktake);
        const map: Record<number, string> = {};
        (data.stocktake.lines ?? []).forEach((l: StocktakeLine) => {
          map[l.id] = l.counted_qty != null ? String(l.counted_qty) : "";
        });
        setCounts(map);
        setShowSyncModal(false);
        setOfflineInput("");
        setSyncConflicts([]);
        if (clearBrowserQueue) {
          localStorage.removeItem(OFFLINE_QUEUE_KEY);
        }
        toast("success", `Offline sync complete! Applied ${data.applied.length} lines.`);
      }
    } catch {
      toast("error", "Offline sync failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleOfflineSync = async (force = false) => {
    if (!stocktake || !offlineInput.trim()) return;
    let lines: Array<{ client_line_key?: string; stock_item_id?: number; barcode?: string; counted_qty: number }> = [];
    try {
      lines = JSON.parse(offlineInput);
    } catch {
      lines = offlineInput
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(",").map((p) => p.trim());
          const first = parts[0];
          const counted = Number(parts[1]);
          const isId = /^\d+$/.test(first);
          return {
            ...(isId ? { stock_item_id: Number(first) } : { barcode: first }),
            counted_qty: Number.isNaN(counted) ? 0 : counted,
          };
        });
    }
    await applyLines(lines, force, false);
  };

  const applyBrowserQueue = async (force = false) => {
    const queue = readBrowserQueue();
    if (queue.length === 0) {
      toast("error", "Browser queue is empty. Scan items first.");
      return;
    }
    await applyLines(
      queue.map((q) => ({
        client_line_key: q.client_line_key,
        stock_item_id: q.stock_item_id,
        barcode: q.barcode,
        counted_qty: Number(q.counted_qty) || 0,
      })),
      force,
      true,
    );
  };

  if (!stocktake) return <p className="text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs font-mono text-neutral-400">{stocktake.reference_number}</p>
          <h1 className="page-title">{stocktake.name}</h1>
          <p className="page-subtitle capitalize">
            Status: {stocktake.status.replace("_", " ")} · Count date: {String(stocktake.count_date).slice(0, 10)}
            {stocktake.is_blind ? " · Blind count" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/stock/stocktakes" className="btn-secondary">Back</Link>
          {canIssue && editable && (
            <>
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => applyBrowserQueue(false)}>
                Apply browser queue
              </button>
              <button type="button" className="btn-secondary" disabled={saving} onClick={() => setShowSyncModal(true)}>
                Offline Sync Queue
              </button>
              <button type="button" className="btn-secondary" disabled={saving} onClick={saveCounts}>Save counts</button>
              <button type="button" className="btn-primary" disabled={saving} onClick={complete}>Submit / Complete</button>
            </>
          )}
          {canIssue && stocktake.status === "pending_approval" && (
            <button type="button" className="btn-primary" disabled={saving} onClick={approveVariances}>
              Approve variances
            </button>
          )}
        </div>
      </div>

      {showSyncModal && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-amber-900 text-sm">Offline Stocktake Queue Sync</h3>
            <button type="button" className="text-xs text-neutral-500 hover:text-neutral-700" onClick={() => setShowSyncModal(false)}>Close</button>
          </div>
          <p className="text-xs text-amber-800">
            Paste offline count lines as JSON array or CSV format (<code className="font-mono">stock_item_id or barcode, counted_qty</code> per line):
          </p>
          <textarea
            rows={4}
            className="w-full form-input text-xs font-mono"
            placeholder={'Example CSV:\n101, 15\nBARCODE123, 8\n\nOr JSON:\n[{"stock_item_id": 101, "counted_qty": 15}]'}
            value={offlineInput}
            onChange={(e) => setOfflineInput(e.target.value)}
          />
          {syncConflicts.length > 0 && (
            <div className="p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800 space-y-1">
              <p className="font-semibold">{syncConflicts.length} conflict(s) detected:</p>
              {syncConflicts.map((c) => (
                <p key={c.line_id}>Line {c.line_id}: Server has {c.server_counted_qty}, Incoming has {c.incoming_counted_qty}</p>
              ))}
            </div>
          )}
          <div className="flex justify-end gap-2">
            {syncConflicts.length > 0 ? (
              <button
                type="button"
                className="btn-primary bg-red-600 hover:bg-red-700"
                disabled={saving}
                onClick={() => (offlineInput.trim() ? handleOfflineSync(true) : applyBrowserQueue(true))}
              >
                Force Overwrite Conflicts
              </button>
            ) : (
              <button type="button" className="btn-primary" disabled={saving || !offlineInput.trim()} onClick={() => handleOfflineSync(false)}>
                Apply Offline Queue
              </button>
            )}
          </div>
        </div>
      )}

      <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
          <tr>
            <th className="px-4 py-2">Item</th>
            <th className="px-4 py-2">System qty</th>
            <th className="px-4 py-2">Counted</th>
            <th className="px-4 py-2">Variance</th>
          </tr>
        </thead>
        <tbody>
          {(stocktake.lines ?? []).map((l) => {
            const counted = counts[l.id] === "" ? null : Number(counts[l.id]);
            const systemQty = l.system_qty;
            const variance =
              counted == null || Number.isNaN(counted) || systemQty == null
                ? null
                : counted - systemQty;
            return (
              <tr key={l.id} className="border-t border-neutral-100">
                <td className="px-4 py-2">
                  <span className="font-mono text-xs text-neutral-400 mr-2">{l.item?.item_code}</span>
                  {l.item?.name}
                </td>
                <td className="px-4 py-2">{systemQty == null ? "—" : systemQty}</td>
                <td className="px-4 py-2">
                  {editable ? (
                    <input
                      type="number"
                      className="form-input w-28"
                      min={0}
                      value={counts[l.id] ?? ""}
                      onChange={(e) => setCounts((p) => ({ ...p, [l.id]: e.target.value }))}
                    />
                  ) : (
                    l.counted_qty ?? "—"
                  )}
                </td>
                <td className={`px-4 py-2 ${variance != null && variance !== 0 ? "text-amber-700 font-medium" : ""}`}>
                  {variance == null ? "—" : variance}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
