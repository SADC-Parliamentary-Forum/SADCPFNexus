"use client";

import { useState } from "react";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";

export default function WeeklyDepartmentPage() {
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [periodId, setPeriodId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Department Summary</h1>
      <p className="text-sm text-neutral-600">
        Consolidates selected employee items — does not rewrite original reports.
      </p>
      <div className="flex gap-2">
        <input
          className="rounded border px-3 py-2 text-sm"
          placeholder="Period ID"
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : "")}
        />
        <button
          type="button"
          className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
          onClick={async () => {
            try {
              setError(null);
              const { data } = await weeklyReportsApi.department(Number(periodId));
              setReport(data.data);
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        >
          Open / create
        </button>
        {report && (
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm"
            onClick={async () => {
              const { data } = await weeklyReportsApi.publish(report.id);
              setReport(data.data);
            }}
          >
            Publish
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-700">{error}</p>}
      {report && (
        <p className="text-sm">
          {report.reference} · {report.status} · v{report.version}
        </p>
      )}
    </div>
  );
}
