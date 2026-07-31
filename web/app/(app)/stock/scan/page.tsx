"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import api from "@/lib/api";

type StockItem = {
  id: number;
  item_code: string;
  barcode?: string | null;
  name: string;
  current_balance?: number;
  available_quantity?: number;
  unit?: string;
};

const OFFLINE_QUEUE_KEY = "sadcpf.stocktake.offlineQueue";

type OfflineLine = {
  client_line_key: string;
  stock_item_id: number;
  barcode?: string;
  counted_qty: number;
  queued_at: string;
};

export default function StockBarcodeScanPage() {
  const [barcode, setBarcode] = useState("");
  const [item, setItem] = useState<StockItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState("1");
  const [queue, setQueue] = useState<OfflineLine[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]") as OfflineLine[];
    } catch {
      return [];
    }
  });

  function persistQueue(next: OfflineLine[]) {
    setQueue(next);
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
  }

  async function lookup(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setItem(null);
    try {
      const r = await api.get<{ data: StockItem }>(`/stock/items/by-barcode/${encodeURIComponent(barcode.trim())}`);
      setItem((r.data as { data: StockItem }).data);
    } catch {
      setErr("No item found for this barcode.");
    }
  }

  function queueOffline() {
    if (!item) return;
    const line: OfflineLine = {
      client_line_key: `offline-${item.id}-${Date.now()}`,
      stock_item_id: item.id,
      barcode: item.barcode ?? barcode,
      counted_qty: Number(count) || 0,
      queued_at: new Date().toISOString(),
    };
    persistQueue([line, ...queue]);
    setMsg(`Queued count for ${item.item_code}. Sync from an open stocktake draft when online.`);
  }

  function clearQueue() {
    persistQueue([]);
    setMsg("Offline queue cleared.");
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/stock" className="hover:text-primary">Stock</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Barcode scan</span>
          </div>
          <h1 className="page-title">Barcode Scan</h1>
          <p className="page-subtitle">
            Scan-to-find stock items. Queue counts offline-friendly for later stocktake sync.
          </p>
        </div>
        <Link href="/stock/stocktakes" className="btn-secondary btn-sm">Stocktakes</Link>
      </div>
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={lookup} className="card flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-[220px] flex-1 text-sm">
          <span className="text-xs font-semibold text-neutral-700">Barcode</span>
          <input
            className="form-input mt-1 w-full"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder="Scan or type barcode"
            autoFocus
            required
          />
        </label>
        <button type="submit" className="btn-primary btn-sm">Find</button>
      </form>

      {item && (
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">{item.name}</h2>
          <p className="text-sm text-neutral-600">Code: {item.item_code} · Barcode: {item.barcode ?? "—"}</p>
          <p className="text-sm text-neutral-600">On hand: {item.current_balance ?? "—"} · Available: {item.available_quantity ?? "—"} {item.unit ?? ""}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="block text-sm">
              <span className="text-xs font-semibold text-neutral-700">Count</span>
              <input type="number" min="0" className="form-input mt-1 w-28" value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary btn-sm" onClick={queueOffline}>Queue offline</button>
          </div>
        </div>
      )}

      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Offline draft queue ({queue.length})</h2>
          {queue.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={clearQueue}>Clear</button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          Stored in browser localStorage. When online, open a stocktake and apply counts with matching client_line_key for idempotent sync.
        </p>
        <ul className="space-y-1 text-sm">
          {queue.map((q) => (
            <li key={q.client_line_key} className="font-mono text-xs text-neutral-700">
              {q.barcode ?? q.stock_item_id} → qty {q.counted_qty} · {q.client_line_key}
            </li>
          ))}
          {queue.length === 0 && <li className="text-neutral-500">Queue empty.</li>}
        </ul>
      </div>
    </div>
  );
}
