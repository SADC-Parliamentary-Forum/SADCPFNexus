"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { stocktakesApi, type Stocktake } from "@/lib/api";
import { canIssueStock, getStoredUser } from "@/lib/auth";
import { useToast } from "@/components/ui/Toast";

export default function StocktakesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Stocktake[]>([]);
  const [canIssue, setCanIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [countDate, setCountDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(() => {
    setLoading(true);
    stocktakesApi.list({ per_page: 50 })
      .then((res) => setRows(res.data.data ?? []))
      .catch(() => toast("error", "Failed to load stocktakes"))
      .finally(() => setLoading(false));
  }, [toast]);

  useEffect(() => {
    setCanIssue(canIssueStock(getStoredUser()));
    load();
  }, [load]);

  const create = async () => {
    if (!name.trim()) {
      toast("error", "Name is required");
      return;
    }
    try {
      const res = await stocktakesApi.create({
        name: name.trim(),
        count_date: countDate,
        include_all_active: true,
      });
      toast("success", "Stocktake created");
      window.location.href = `/stock/stocktakes/${res.data.data.id}`;
    } catch {
      toast("error", "Could not create stocktake (need active items)");
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Stocktakes</h1>
          <p className="page-subtitle">Physical counts with variance posted as ledger adjustments.</p>
        </div>
      </div>

      {canIssue && (
        <div className="rounded-xl border border-neutral-200 bg-white p-4 flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold mb-1">Name</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Q3 store count" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Count date</label>
            <input type="date" className="form-input" value={countDate} onChange={(e) => setCountDate(e.target.value)} />
          </div>
          <button type="button" className="btn-primary" onClick={create}>Start stocktake (all active)</button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : (
        <table className="w-full text-sm bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <thead className="bg-neutral-50 text-left text-xs text-neutral-500">
            <tr>
              <th className="px-4 py-2">Reference</th>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Date</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Lines</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-100">
                <td className="px-4 py-2 font-mono text-xs">
                  <Link href={`/stock/stocktakes/${r.id}`} className="text-primary hover:underline">{r.reference_number}</Link>
                </td>
                <td className="px-4 py-2">{r.name}</td>
                <td className="px-4 py-2">{r.count_date?.slice?.(0, 10) ?? r.count_date}</td>
                <td className="px-4 py-2 capitalize">{r.status.replace("_", " ")}</td>
                <td className="px-4 py-2">{r.lines_count ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
