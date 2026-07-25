"use client";

import { useState } from "react";
import Link from "next/link";
import api from "@/lib/api";

const REPORTS = [
  { id: "register", label: "Full register", hint: "All salary advances for the tenant", pack: "register", status: "" },
  { id: "outstanding", label: "Outstanding advances", hint: "Positive BCRE balance", pack: "outstanding", status: "" },
  { id: "by-status", label: "By status — submitted", hint: "Pending finance certification", pack: "", status: "submitted" },
  { id: "recovery", label: "Recovery pack", hint: "Paid through closed recovery lifecycle", pack: "recovery", status: "" },
] as const;

export default function SalaryAdvanceReportsPage() {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (reportId: string, pack: string, status: string) => {
    setBusy(reportId);
    setError(null);
    try {
      const params: Record<string, string> = { format: "csv" };
      if (pack) params.pack = pack;
      if (status) params.status = status;
      const res = await api.get("/reports/salary-advances", { params, responseType: "blob" });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `salary-advances-${reportId}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Ensure you have salary_advance.export / reports.export permission.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-500 mb-1">
          <Link href="/salary-advances" className="hover:text-neutral-700">Salary Advances</Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">Reports</span>
        </div>
        <h1 className="page-title">Salary Advance Reports</h1>
        <p className="page-subtitle">CSV exports for register, outstanding, status, and recovery packs.</p>
      </div>

      {error && <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>}

      <div className="grid gap-4 sm:grid-cols-2">
        {REPORTS.map((r) => (
          <div key={r.id} className="card p-5 space-y-3">
            <h2 className="text-sm font-semibold text-neutral-900">{r.label}</h2>
            <p className="text-xs text-neutral-500">{r.hint}</p>
            <button
              type="button"
              disabled={busy === r.id}
              onClick={() => download(r.id, r.pack, r.status)}
              className="btn-primary py-2 px-4 text-sm disabled:opacity-40"
            >
              {busy === r.id ? "Exporting…" : "Download CSV"}
            </button>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <p className="text-sm text-neutral-600">
          For interactive browsing, use the{" "}
          <Link href="/salary-advances/register" className="text-primary font-medium hover:underline">Salary Advance Register</Link>
          {" "}or the central{" "}
          <Link href="/reports" className="text-primary font-medium hover:underline">Reports</Link> module.
        </p>
      </div>
    </div>
  );
}
