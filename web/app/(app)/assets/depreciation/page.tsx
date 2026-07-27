"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Run = {
  id: number;
  run_date: string;
  asset_count: number;
  total_depreciation: number;
  status: string;
};

export default function AssetDepreciationPage() {
  const [runs, setRuns] = useState<Run[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await api.get<{ data: Run[] }>("/assets-meta/depreciation-runs");
    setRuns(Array.isArray(r.data.data) ? r.data.data : []);
  }

  useEffect(() => { load().catch(() => setRuns([])); }, []);

  async function runNow() {
    setBusy(true);
    try {
      const r = await api.post<{ message: string }>("/assets-meta/depreciation-runs", {});
      setMsg(r.data.message ?? "Depreciation run completed (monitoring only).");
      await load();
    } catch {
      setMsg("Unable to run depreciation.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Depreciation</h1>
          <p className="page-subtitle">Nexus calculates for monitoring/reports. Official GL remains the accounting system.</p>
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={runNow}>
          {busy ? "Running…" : "Run depreciation"}
        </button>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Run date</th><th>Assets</th><th>Total depreciation</th><th>Status</th></tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td>{r.run_date}</td>
                <td>{r.asset_count}</td>
                <td>{Number(r.total_depreciation).toFixed(2)}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={4}>No runs yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
