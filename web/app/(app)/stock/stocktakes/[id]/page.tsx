"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { stocktakesApi, type Stocktake, type StocktakeLine } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

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
