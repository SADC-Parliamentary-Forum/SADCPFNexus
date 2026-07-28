"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { cn } from "@/lib/utils";

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
      setError(e instanceof Error ? e.message : "Failed to load overtime requests");
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
      setError(err instanceof Error ? err.message : "Could not create requisition");
    } finally {
      setSaving(false);
    }
  }

  async function submitReq(id: number) {
    await api.post(`/hr/overtime-requisitions/${id}/submit`);
    await load();
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">My Overtime Requests</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Overtime must be authorised before it is worked. Planned and actual hours are separate.
          </p>
        </div>
        <Link href="/hr/timesheets" className="text-sm text-[var(--brand)] hover:underline">
          Back to timesheets
        </Link>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <form onSubmit={createRequest} className="grid gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 md:grid-cols-2">
        <label className="text-sm">
          Work date
          <input
            type="date"
            required
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.work_date}
            onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          Planned hours
          <input
            type="number"
            min={0.25}
            step={0.25}
            required
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.planned_hours}
            onChange={(e) => setForm((f) => ({ ...f, planned_hours: e.target.value }))}
          />
        </label>
        <label className="text-sm md:col-span-2">
          Reason
          <textarea
            required
            className="mt-1 w-full rounded border px-3 py-2"
            rows={2}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
          />
        </label>
        <label className="text-sm">
          Day type
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={form.day_type}
            onChange={(e) => setForm((f) => ({ ...f, day_type: e.target.value }))}
          >
            <option value="normal_working_day">Normal working day (1.5Ã—)</option>
            <option value="weekend">Weekend (rate must be configured)</option>
            <option value="public_holiday">Public holiday (rate must be configured)</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Savingâ€¦" : "Create draft requisition"}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-lg border border-[var(--border)]">
        <table className="min-w-full text-sm">
          <thead className="bg-[var(--surface-muted)] text-left">
            <tr>
              <th className="px-3 py-2">Reference</th>
              <th className="px-3 py-2">Date</th>
              <th className="px-3 py-2">Planned</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-secondary)]">
                  Loadingâ€¦
                </td>
              </tr>
            )}
            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-[var(--text-secondary)]">
                  No overtime requisitions yet.
                </td>
              </tr>
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
                      className="text-[var(--brand)] hover:underline"
                      onClick={() => void submitReq(row.id)}
                    >
                      Submit
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
