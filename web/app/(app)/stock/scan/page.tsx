"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import api, { stockEventPacksApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useI18n } from "@/lib/i18n/LocaleProvider";

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
  const { t } = useI18n();
  const [barcode, setBarcode] = useState("");
  const [item, setItem] = useState<StockItem | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [count, setCount] = useState("1");
  const [bulk, setBulk] = useState("");
  const [bulkResult, setBulkResult] = useState<{ matched: Array<Record<string, unknown>>; missing: string[] } | null>(null);
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
      setErr(t("stock.scan.notFound"));
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
    setMsg(t("stock.scan.queued", { code: item.item_code }));
  }

  function clearQueue() {
    persistQueue([]);
    setMsg(t("stock.scan.cleared"));
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={t("stock.scan.title")}
        subtitle={t("stock.scan.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("stock.common.stock"), href: "/stock" }, { label: t("stock.scan.crumb") }]} />}
        actions={
          <>
            <Link href="/stock/event-packs" className="btn-secondary btn-sm">{t("stock.eventPacks.title")}</Link>
            <Link href="/stock/stocktakes" className="btn-secondary btn-sm">{t("stock.scan.openStocktake")}</Link>
          </>
        }
      />
      {msg && <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{msg}</div>}
      {err && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{err}</div>}

      <form onSubmit={lookup} className="card flex flex-wrap items-end gap-3 p-4">
        <label htmlFor="stock-scan-barcode-setbarcode-e-target-value-placeholder-sc" className="block min-w-[220px] flex-1 text-sm">
          <span className="text-xs font-semibold text-neutral-700">{t("stock.scan.barcode")}</span>
          <input id="stock-scan-barcode-setbarcode-e-target-value-placeholder-sc"
            className="form-input mt-1 w-full"
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            placeholder={t("stock.scan.barcodePlaceholder")}
            autoFocus
            required
          />
        </label>
        <button type="submit" className="btn-primary btn-sm">{t("stock.scan.find")}</button>
      </form>

      {item && (
        <div className="card space-y-3 p-4">
          <h2 className="text-sm font-semibold text-neutral-900">{item.name}</h2>
          <p className="text-sm text-neutral-600">{t("stock.scan.codeLine", { code: item.item_code, barcode: item.barcode ?? "—" })}</p>
          <p className="text-sm text-neutral-600">{t("stock.scan.balanceLine", { onHand: item.current_balance ?? "—", available: item.available_quantity ?? "—", unit: item.unit ?? "" })}</p>
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor="stock-scan-count-setcount-e-target-value" className="block text-sm">
              <span className="text-xs font-semibold text-neutral-700">{t("stock.scan.count")}</span>
              <input id="stock-scan-count-setcount-e-target-value" type="number" min="0" className="form-input mt-1 w-28" value={count} onChange={(e) => setCount(e.target.value)} />
            </label>
            <button type="button" className="btn-secondary btn-sm" onClick={queueOffline}>{t("stock.scan.queueOffline")}</button>
          </div>
        </div>
      )}

      <div className="card space-y-2 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">{t("stock.scan.queueTitle", { count: queue.length })}</h2>
          {queue.length > 0 && (
            <button type="button" className="btn-secondary btn-sm" onClick={clearQueue}>{t("stock.scan.clear")}</button>
          )}
        </div>
        <p className="text-xs text-neutral-500">
          {t("stock.scan.queueHintBefore")} <strong>{t("stock.common.applyBrowserQueue")}</strong> {t("stock.scan.queueHintAfter")}
        </p>
        <ul className="space-y-1 text-sm">
          {queue.map((q) => (
            <li key={q.client_line_key} className="font-mono text-xs text-neutral-700">
              {t("stock.scan.queueLine", { code: q.barcode ?? q.stock_item_id, qty: q.counted_qty, key: q.client_line_key })}
            </li>
          ))}
          {queue.length === 0 && <li className="text-neutral-500">{t("stock.scan.queueEmpty")}</li>}
        </ul>
      </div>

      <form
        className="card space-y-3 p-4"
        data-testid="barcode-bulk-lookup"
        onSubmit={async (e) => {
          e.preventDefault();
          const codes = bulk.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
          const r = await stockEventPacksApi.barcodeLookup(codes);
          setBulkResult(r.data.data);
        }}
      >
        <h2 className="text-sm font-semibold text-neutral-900">{t("stock.scan.bulkTitle")}</h2>
        <textarea className="form-input min-h-[90px]" value={bulk} onChange={(e) => setBulk(e.target.value)} placeholder={t("stock.scan.bulkPlaceholder")} />
        <button type="submit" className="btn-secondary text-sm">{t("stock.scan.bulkLookup")}</button>
        {bulkResult && (
          <p className="text-sm text-neutral-700">
            {t("stock.scan.bulkResult", { matched: bulkResult.matched.length, missing: bulkResult.missing.join(", ") || t("stock.scan.none") })}
          </p>
        )}
      </form>
    </div>
  );
}
