"use client";

import { useState } from "react";
import api from "@/lib/api";

export default function AssetReportsPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadCsv() {
    setBusy(true);
    setMsg(null);
    try {
      const data = await api.get<{ data: Record<string, unknown>[] }>("/assets/register-export?format=json");
      const rows = data.data ?? [];
      if (!rows.length) {
        setMsg("Register is empty.");
        return;
      }
      const keys = Object.keys(rows[0]);
      const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fixed-asset-register-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMsg("Unable to export register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Fixed Asset Reports</h1>
          <p className="page-subtitle">Register export and operational reports</p>
        </div>
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>Fixed Asset Register Export</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Export description, tag, serial, acquisition, cost, funding, useful life, depreciation and location fields.
        </p>
        <button className="btn btn-primary" disabled={busy} onClick={downloadCsv}>
          {busy ? "Preparing…" : "Download CSV"}
        </button>
      </div>
    </div>
  );
}
