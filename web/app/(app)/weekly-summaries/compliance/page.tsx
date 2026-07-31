"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useEffect, useState } from "react";
import { weeklyReportsApi } from "@/lib/api";

export default function WeeklyCompliancePage() {
  const [dashboard, setDashboard] = useState<Record<string, unknown> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    const { data } = await weeklyReportsApi.dashboard();
    setDashboard(data.data as Record<string, unknown>);
  }

  useEffect(() => {
    void load().catch(() => setDashboard(null));
  }, []);

  const compliance = (dashboard?.compliance as Record<string, number> | undefined) ?? {};
  const missing = (dashboard?.missing_reports as Array<Record<string, unknown>> | undefined) ?? [];
  const period = dashboard?.period as { reference?: string; start_date?: string; end_date?: string } | undefined;

  function exportCsv() {
    const lines = ["name,id", ...missing.map((m) => `"${String(m.name ?? "")}",${String(m.id ?? "")}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-compliance-missing-${period?.reference ?? "current"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setMsg("CSV exported (client-side). Digests are also scheduled Mondays 08:40.");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <ModulePageHeader
        title="Weekly report compliance"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Weekly report compliance" }]} />}
      />
      {msg && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{msg}</div>}
      <p className="text-sm text-neutral-600">
        Submitted: {compliance.submitted ?? 0} · Exempted: {compliance.exempted ?? 0} · Missing: {missing.length}
      </p>
      <div className="flex gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void load()}>Refresh</button>
        <button type="button" className="btn-secondary btn-sm" onClick={exportCsv} disabled={missing.length === 0}>
          Export missing CSV
        </button>
      </div>
      <h2 className="text-lg font-medium">Missing</h2>
      <ul className="space-y-1 text-sm">
        {missing.map((m) => (
          <li key={String(m.id)}>{String(m.name)}</li>
        ))}
        {missing.length === 0 && <li className="text-neutral-500">No missing reports in scope.</li>}
      </ul>
    </div>
  );
}
