"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

type AssetOption = { id: number; asset_code: string; name: string; book_value?: number };
type Revaluation = {
  id: number;
  reference: string;
  status: string;
  previous_book_value?: number;
  proposed_value: number;
  reason: string;
  effective_date: string;
  asset?: AssetOption;
};

export default function AssetRevaluationPage() {
  const [rows, setRows] = useState<Revaluation[]>([]);
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({
    asset_id: "",
    proposed_value: "",
    reason: "",
    effective_date: new Date().toISOString().slice(0, 10),
  });

  async function load() {
    const r = await api.get<{ data: Revaluation[] }>("/asset-revaluations");
    const body = r.data as { data?: Revaluation[] };
    setRows(Array.isArray(body.data) ? body.data : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
    api.get<{ data: AssetOption[] }>("/assets", { params: { status: "active", per_page: 100 } })
      .then((r) => setAssets(Array.isArray((r.data as { data?: AssetOption[] }).data) ? (r.data as { data: AssetOption[] }).data : []))
      .catch(() => setAssets([]));
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    try {
      await api.post("/asset-revaluations", {
        asset_id: Number(form.asset_id),
        proposed_value: Number(form.proposed_value),
        reason: form.reason,
        effective_date: form.effective_date,
      });
      setMsg("Revaluation requested.");
      setForm({ asset_id: "", proposed_value: "", reason: "", effective_date: new Date().toISOString().slice(0, 10) });
      await load();
    } catch (error: unknown) {
      setErr(error instanceof Error ? error.message : "Failed to request revaluation.");
    }
  }

  async function approve(id: number) {
    await api.post(`/asset-revaluations/${id}/approve`, { comments: "Approved" });
    setMsg("Revaluation approved — book value updated.");
    await load();
  }

  return (
    <div className="page-container space-y-4">
      <div className="page-header flex items-start justify-between gap-3">
        <div>
          <h1 className="page-title">Asset Revaluations</h1>
          <p className="page-subtitle">Request → Finance approve → book value update. No GL posting.</p>
        </div>
        <Link href="/assets/disposal" className="btn btn-secondary btn-sm">Disposals</Link>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <form onSubmit={create} className="card space-y-3 p-4">
        <h2 className="text-lg font-semibold">New revaluation</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">
            Asset
            <select className="form-input mt-1 w-full" required value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })}>
              <option value="">Select…</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id}>{a.asset_code} — {a.name} (BV {a.book_value ?? "—"})</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            Proposed value
            <input type="number" min="0" step="0.01" required className="form-input mt-1 w-full" value={form.proposed_value} onChange={(e) => setForm({ ...form, proposed_value: e.target.value })} />
          </label>
          <label className="block text-sm">
            Effective date
            <input type="date" required className="form-input mt-1 w-full" value={form.effective_date} onChange={(e) => setForm({ ...form, effective_date: e.target.value })} />
          </label>
          <label className="block text-sm md:col-span-2">
            Reason
            <textarea required rows={2} className="form-input mt-1 w-full" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
        </div>
        <button type="submit" className="btn btn-primary btn-sm">Submit</button>
      </form>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Reference</th><th>Asset</th><th>Previous</th><th>Proposed</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.reference}</td>
                <td>{r.asset?.asset_code ?? "—"}</td>
                <td>{r.previous_book_value ?? "—"}</td>
                <td>{r.proposed_value}</td>
                <td>{r.status}</td>
                <td>
                  {r.status === "pending" && (
                    <button type="button" className="btn btn-sm btn-primary" onClick={() => approve(r.id)}>Approve</button>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6}>No revaluations.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
