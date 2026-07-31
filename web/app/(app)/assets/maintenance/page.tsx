"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";

type RecordRow = {
  id: number;
  title: string;
  status: string;
  maintenance_type: string;
  under_warranty: boolean;
  asset?: { asset_code: string; name: string };
};

export default function AssetMaintenancePage() {
  const [rows, setRows] = useState<RecordRow[]>([]);

  useEffect(() => {
    api.get<{ data: RecordRow[] }>("/assets-meta/maintenance")
      .then((r) => setRows(Array.isArray(r.data.data) ? r.data.data : []))
      .catch(() => setRows([]));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Maintenance & Warranty</h1>
          <p className="page-subtitle">Corrective, preventive and warranty repair history</p>
        </div>
      </div>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr><th>Asset</th><th>Title</th><th>Type</th><th>Warranty</th><th>Status</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.asset?.asset_code ?? "—"}</td>
                <td>{r.title}</td>
                <td>{r.maintenance_type}</td>
                <td>{r.under_warranty ? "Yes" : "No"}</td>
                <td>{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5}>No maintenance records.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
