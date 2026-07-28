"use client";

import Link from "next/link";
import { useState } from "react";
import api from "@/lib/api";

export default function TimesheetPayrollExportPage() {
  const [ids, setIds] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function exportBatch(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setResult(null);
    try {
      const settlement_ids = ids
        .split(/[\s,]+/)
        .map((x) => Number(x.trim()))
        .filter((n) => n > 0);
      const res = await api.post<{ data: { batch_reference: string; id: number; lines?: unknown[] } }>(
        "/hr/timesheets/payroll-exports",
        { settlement_ids, idempotency_key: `ui-${settlement_ids.join("-")}` }
      );
      const body = res.data as { data?: { batch_reference?: string; id?: number }; batch_reference?: string; id?: number };
      const batch = body.data ?? body;
      setResult(`Exported batch ${batch.batch_reference ?? "?"} (#${batch.id ?? "?"}). Re-submit is idempotent.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Overtime Payroll Export</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Finance processes payment from HR-validated pay settlements. TOIL settlements are excluded. Every line is
          traceable to an authorised overtime actual.
        </p>
      </div>
      <Link href="/hr/timesheets/overtime" className="text-sm text-[var(--brand)] hover:underline">
        Overtime queue
      </Link>

      <form onSubmit={exportBatch} className="space-y-3 rounded-lg border border-[var(--border)] p-4">
        <label className="block text-sm">
          Settlement IDs (comma-separated)
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            value={ids}
            onChange={(e) => setIds(e.target.value)}
            placeholder="12, 15, 18"
            required
          />
        </label>
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-[var(--brand)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {saving ? "Exporting…" : "Create payroll export"}
        </button>
      </form>

      {error && <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>}
      {result && <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{result}</div>}
    </div>
  );
}
