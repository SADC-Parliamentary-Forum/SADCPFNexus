"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { hrApi } from "@/lib/api";

type Period = { id: number; label?: string; period_start: string; period_end: string; status?: string };
type Batch = {
  id: number;
  batch_reference: string;
  status?: string;
  created_at?: string;
};

export default function TimesheetPayrollExportPage() {
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [batches, setBatches] = useState<Batch[]>([]);
  const [staging, setStaging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const loadPeriods = useCallback(async () => {
    try {
      const res = await hrApi.listTimesheetPeriods();
      const body = res.data as { data?: Period[] } | Period[];
      const list = Array.isArray(body) ? body : Array.isArray(body.data) ? body.data : [];
      setPeriods(list);
    } catch {
      setPeriods([]);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const res = await hrApi.listPayrollExports();
      const body = res.data as { data?: Batch[] };
      setBatches(Array.isArray(body.data) ? body.data : []);
    } catch {
      setBatches([]);
    }
  }, []);

  useEffect(() => {
    void loadPeriods();
    void loadHistory();
  }, [loadPeriods, loadHistory]);

  async function stageBatch() {
    if (!selectedPeriodId) {
      setError("Select a timesheet period first.");
      return;
    }
    setStaging(true);
    setError(null);
    setResult(null);
    try {
      const res = await hrApi.stagePayrollExport({
        period_id: Number(selectedPeriodId),
        idempotency_key: `payroll-ui-${selectedPeriodId}-${Date.now()}`,
        mark_included: true,
        lock_period: true,
      });
      const batch = (res.data as { data?: { id: number; batch_reference: string } }).data;
      setResult(`Staged batch ${batch?.batch_reference ?? "?"} (#${batch?.id ?? "?"}). TOIL payable hours stay 0.`);
      await loadHistory();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : "Failed to stage payroll export.");
      setError(msg);
    } finally {
      setStaging(false);
    }
  }

  async function download(batch: Batch, format: "csv" | "xlsx" = "csv") {
    try {
      const res = await hrApi.downloadPayrollExport(batch.id, format);
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payroll-${batch.batch_reference}.${format === "xlsx" ? "xlsx" : "csv"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Download failed.");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <ModulePageHeader
        title="Payroll Export Console"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Payroll Export Console" }]} />}
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/hr/timesheets/team" className="text-[var(--brand)] hover:underline">Team approval</Link>
        <Link href="/hr/timesheets/overtime" className="text-[var(--brand)] hover:underline">Overtime queue</Link>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] p-4" data-testid="payroll-operator-stage">
        <label className="block text-sm">
          Timesheet period
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            data-testid="payroll-period"
          >
            <option value="">Select period…</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label || `${p.period_start} → ${p.period_end}`} {p.status ? `(${p.status})` : ""}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={staging || !selectedPeriodId}
          onClick={() => void stageBatch()}
          className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {staging ? "Staging…" : "Stage payroll batch"}
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {result && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{result}</div>}

      <div>
        <h2 className="mb-2 text-lg font-medium">Export history</h2>
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left">Batch</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Created</th>
                <th className="px-3 py-2 text-left">Download</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{b.batch_reference}</td>
                  <td className="px-3 py-2">{b.status ?? "—"}</td>
                  <td className="px-3 py-2">{b.created_at ? new Date(b.created_at).toLocaleString() : "—"}</td>
                  <td className="space-x-2 px-3 py-2">
                    <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => void download(b, "csv")}>CSV</button>
                    <button type="button" className="text-[var(--brand)] hover:underline" onClick={() => void download(b, "xlsx")}>XLSX</button>
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <tr><td colSpan={4} className="px-3 py-4 text-neutral-500">No payroll export batches yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
