"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type Disposal = {
  id: number;
  reference: string;
  status: string;
  reason: string;
  justification: string;
  asset?: { asset_code: string; name: string };
};

export default function AssetDisposalPage() {
  const [rows, setRows] = useState<Disposal[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const r = await api.get<{ data: Disposal[] }>("/asset-disposals");
    setRows(Array.isArray(r.data) ? r.data : []);
  }

  useEffect(() => { load().catch(() => setRows([])); }, []);

  async function advance(id: number, action: string) {
    await api.post(`/asset-disposals/${id}/${action}`, {});
    setMsg(`Disposal ${action} recorded.`);
    await load();
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Disposal Requests</h1>
          <p className="page-subtitle">Workflow: request → HOD recommend → Finance review → approve → complete. Assets are never hard-deleted.</p>
        </div>
      </div>
      {msg && <div className="alert alert-success">{msg}</div>}
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Reference</th><th>Asset</th><th>Reason</th><th>Status</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {rows.map((d) => (
              <tr key={d.id}>
                <td>{d.reference}</td>
                <td>{d.asset?.asset_code ?? "—"}</td>
                <td>{d.reason}</td>
                <td>{d.status}</td>
                <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {d.status === "draft" && <button className="btn btn-sm" onClick={() => advance(d.id, "recommend")}>HOD recommend</button>}
                  {d.status === "recommended" && <button className="btn btn-sm" onClick={() => advance(d.id, "finance-review")}>Finance review</button>}
                  {d.status === "finance_reviewed" && <button className="btn btn-sm" onClick={() => advance(d.id, "approve")}>Approve</button>}
                  {d.status === "approved" && <button className="btn btn-sm btn-primary" onClick={() => advance(d.id, "complete")}>Complete</button>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5}>No disposal requests.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
