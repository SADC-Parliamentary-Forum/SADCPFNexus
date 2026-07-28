"use client";

import { useState } from "react";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";

export default function WeeklyInstitutionalPage() {
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [periodId, setPeriodId] = useState<number | "">("");

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Institutional Summary</h1>
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
            const { data } = await weeklyReportsApi.institutional(Number(periodId));
            setReport(data.data);
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
      {report && (
        <p className="text-sm">
          {report.reference} · {report.status} · v{report.version}
        </p>
      )}
    </div>
  );
}
