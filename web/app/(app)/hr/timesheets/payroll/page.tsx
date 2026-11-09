"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { hrApi } from "@/lib/api";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type Period = { id: number; label?: string; period_start: string; period_end: string; status?: string };
type Batch = {
  id: number;
  batch_reference: string;
  status?: string;
  created_at?: string;
};

export default function TimesheetPayrollExportPage() {
  const { t, localeTag } = useI18n();
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
      setError(t("hr.timesheets.payroll.selectPeriodFirst"));
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
      setResult(t("hr.timesheets.payroll.staged", { reference: batch?.batch_reference ?? "?", id: batch?.id ?? "?" }));
      await loadHistory();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : t("hr.timesheets.payroll.stageFailed"));
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
      setError(t("hr.timesheets.payroll.downloadFailed"));
    }
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="hr.timesheets.payroll.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "hr.timesheets.payroll.title" }]} />}
      />

      <div className="flex flex-wrap gap-3 text-sm">
        <Link href="/hr/timesheets/team" className="btn-secondary text-xs py-1 px-2">{t("hr.timesheets.payroll.teamApproval")}</Link>
        <Link href="/hr/timesheets/overtime" className="btn-secondary text-xs py-1 px-2">{t("hr.timesheets.payroll.overtimeQueue")}</Link>
      </div>

      <div className="space-y-3 rounded-lg border border-[var(--border)] p-4" data-testid="payroll-operator-stage">
        <label htmlFor="hr-timesheets-payroll-timesheet-period-setselectedperiodid-e-target-va" className="block text-sm">
          {t("hr.timesheets.payroll.period")}
          <select id="hr-timesheets-payroll-timesheet-period-setselectedperiodid-e-target-va"
            className="mt-1 w-full rounded border px-3 py-2"
            value={selectedPeriodId}
            onChange={(e) => setSelectedPeriodId(e.target.value)}
            data-testid="payroll-period"
          >
            <option value="">{t("hr.timesheets.payroll.selectPeriod")}</option>
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
          {staging ? t("hr.timesheets.payroll.staging") : t("hr.timesheets.payroll.stage")}
        </button>
      </div>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {result && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{result}</div>}

      <div>
        <h2 className="mb-2 text-lg font-medium">{t("hr.timesheets.payroll.history")}</h2>
        <div className="overflow-x-auto rounded border border-[var(--border)]">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50">
              <tr>
                <th className="px-3 py-2 text-left">{t("hr.timesheets.payroll.batch")}</th>
                <th className="px-3 py-2 text-left">{t("hr.timesheets.monthly.status")}</th>
                <th className="px-3 py-2 text-left">{t("hr.timesheets.payroll.created")}</th>
                <th className="px-3 py-2 text-left">{t("common.download")}</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b.id} className="border-t">
                  <td className="px-3 py-2 font-mono">{b.batch_reference}</td>
                  <td className="px-3 py-2">{b.status ?? "—"}</td>
                  <td className="px-3 py-2">{b.created_at ? new Date(b.created_at).toLocaleString(localeTag) : "—"}</td>
                  <td className="space-x-2 px-3 py-2">
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => void download(b, "csv")}>CSV</button>{/* i18n-ignore */}
                    <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => void download(b, "xlsx")}>XLSX</button>{/* i18n-ignore */}
                  </td>
                </tr>
              ))}
              {batches.length === 0 && (
                <TableEmpty colSpan={4} title={t("hr.timesheets.payroll.empty")} />
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
