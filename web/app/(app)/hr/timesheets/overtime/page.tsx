"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";
import { TableEmpty } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type OtReq = {
  id: number;
  reference?: string;
  work_date: string;
  planned_hours: number;
  day_type: string;
  status: string;
  reason: string;
  is_emergency?: boolean;
  actuals?: Array<{ id: number; actual_hours: number; status: string; multiplier?: number }>;
};

export default function OvertimeRequestsPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<OtReq[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    work_date: "",
    planned_hours: "2",
    reason: "",
    day_type: "normal_working_day",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/hr/overtime-requisitions");
      const payload = res.data as unknown;
      const rows = Array.isArray(payload)
        ? payload
        : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
          ? (payload as { data: OtReq[] }).data
          : [];
      setItems(rows as OtReq[]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("hr.timesheets.overtime.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRequest(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.post("/hr/overtime-requisitions", {
        work_date: form.work_date,
        planned_hours: Number(form.planned_hours),
        reason: form.reason,
        day_type: form.day_type,
      });
      setForm({ work_date: "", planned_hours: "2", reason: "", day_type: "normal_working_day" });
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t("hr.timesheets.overtime.createFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function submitReq(id: number) {
    await api.post(`/hr/overtime-requisitions/${id}/submit`);
    await load();
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <ModulePageHeader
        title="hr.timesheets.overtime.title"
        breadcrumbs={<PageBreadcrumbs items={[{ label: "hr.timesheets.overtime.title" }]} />}
      />
        <Link href="/hr/timesheets" className="btn-secondary text-sm py-1 px-2">
          {t("hr.timesheets.overtime.back")}
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <form onSubmit={createRequest} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <label htmlFor="hr-timesheets-overtime-work-date-setform-f" className="text-sm">
          {t("hr.timesheets.overtime.workDate")}
          <input id="hr-timesheets-overtime-work-date-setform-f"
            type="date"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.work_date}
            onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
          />
        </label>
        <label htmlFor="hr-timesheets-overtime-planned-hours-setform-f" className="text-sm">
          {t("hr.timesheets.overtime.plannedHours")}
          <input id="hr-timesheets-overtime-planned-hours-setform-f"
            type="number"
            min={0.25}
            step={0.25}
            required
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.planned_hours}
            onChange={(e) => setForm((f) => ({ ...f, planned_hours: e.target.value }))}
          />
        </label>
        <label htmlFor="hr-timesheets-overtime-reason-setform-f" className="text-sm md:col-span-2">
          {t("common.reason")}
          <textarea id="hr-timesheets-overtime-reason-setform-f"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            rows={2}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </label>
        <label htmlFor="hr-timesheets-overtime-day-type-setform-f-normal-working-day-1-5-weeken" className="text-sm">
          {t("hr.timesheets.overtime.dayType")}
          <select id="hr-timesheets-overtime-day-type-setform-f-normal-working-day-1-5-weeken"
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.day_type}
            onChange={(e) => setForm((f) => ({ ...f, day_type: e.target.value }))}
          >
            <option value="normal_working_day">{t("hr.timesheets.overtime.normalDay")}</option>
            <option value="weekend">{t("hr.timesheets.overtime.weekendDay")}</option>
            <option value="public_holiday">{t("hr.timesheets.overtime.holidayDay")}</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? t("hr.timesheets.saving") : t("hr.timesheets.overtime.create")}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface-muted)] text-left">
            <tr>
              <th className="px-3 py-2">{t("hr.timesheets.overtime.reference")}</th>
              <th className="px-3 py-2">{t("hr.timesheets.col.date")}</th>
              <th className="px-3 py-2">{t("hr.timesheets.overtime.planned")}</th>
              <th className="px-3 py-2">{t("hr.timesheets.monthly.status")}</th>
              <th className="px-3 py-2">{t("hr.timesheets.overtime.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-secondary)]">
                  {t("common.loading")}
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <TableEmpty colSpan={5} title={t("hr.timesheets.overtime.empty")} />
            )}
            {items.map((row) => (
              <tr key={row.id} className="border-t border-[var(--border)]">
                <td className="px-3 py-2 font-medium">{row.reference ?? `#${row.id}`}</td>
                <td className="px-3 py-2">{row.work_date}</td>
                <td className="px-3 py-2">{row.planned_hours}h</td>
                <td className="px-3 py-2">
                  <span className={cn("rounded px-2 py-0.5 text-xs", "bg-slate-100")}>{row.status}</span>
                </td>
                <td className="px-3 py-2">
                  {row.status === "draft" && (
                    <button
                      type="button"
                      className="btn-secondary text-xs py-1 px-2"
                      onClick={() => void submitReq(row.id)}
                    >
                      {t("common.submit")}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
