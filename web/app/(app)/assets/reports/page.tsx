"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useState } from "react";
import { assetsApi } from "@/lib/api";

function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AssetReportsPage() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function downloadCsv() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await assetsApi.registerExport({ format: "csv" });
      const blob = res.data as Blob;
      const type = (blob.type || "").toLowerCase();
      const peek = await blob.slice(0, 8).text();
      if (type.includes("json") || peek.trim().startsWith("{")) {
        setMsg("Unable to export register.");
        return;
      }
      downloadBlob(blob, `fixed-asset-register-${new Date().toISOString().slice(0, 10)}.csv`);
    } catch {
      setMsg("Unable to export register.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-5">
      <div className="page-header">
        <ModulePageHeader
        title="Fixed Asset Reports"
        subtitle="Register export and operational reports"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Fixed Asset Reports" }]} />}
      />
      </div>
      {msg && <div className="alert alert-info">{msg}</div>}
      <div className="card" style={{ padding: "1.25rem" }}>
        <h2 style={{ fontSize: "1.1rem", marginBottom: 8 }}>Fixed Asset Register Export</h2>
        <p className="text-muted" style={{ marginBottom: 16 }}>
          Export description, tag, serial, acquisition, cost, funding, useful life, depreciation and location fields.
        </p>
        <button className="btn-primary" disabled={busy} onClick={downloadCsv} data-testid="asset-reports-download-csv">
          {busy ? "Preparing…" : "Download CSV"}
        </button>
      </div>
    </div>
  );
}
