"use client";

import { useState } from "react";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

export default function WeeklyDepartmentPage() {
  const { toast } = useToast();
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [periodId, setPeriodId] = useState<number | "">("");
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [publishing, setPublishing] = useState(false);

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <h1 className="text-2xl font-semibold">Department Summary</h1>
      <p className="text-sm text-neutral-600">
        Consolidates selected employee items — does not rewrite original reports.
      </p>
      <div className="flex gap-2">
        <label className="sr-only" htmlFor="weekly-period-id">Period ID</label>
        <input
          id="weekly-period-id"
          className="rounded border px-3 py-2 text-sm disabled:opacity-60"
          placeholder="Period ID"
          value={periodId}
          onChange={(e) => setPeriodId(e.target.value ? Number(e.target.value) : "")}
          disabled={opening}
        />
        <button
          type="button"
          className="rounded bg-emerald-800 px-3 py-2 text-sm text-white disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={opening || !periodId}
          onClick={async () => {
            if (opening) return;
            setOpening(true);
            try {
              setError(null);
              const { data } = await weeklyReportsApi.department(Number(periodId));
              setReport(data.data);
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            } finally {
              setOpening(false);
            }
          }}
        >
          {opening ? "Opening..." : "Open / create"}
        </button>
        {report && (
          <button
            type="button"
            className="rounded border px-3 py-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={publishing}
            onClick={async () => {
              if (publishing) return;
              setPublishing(true);
              try {
                const { data } = await weeklyReportsApi.publish(report.id);
                setReport(data.data);
              } catch (e: unknown) {
                toast("error", e instanceof Error ? e.message : "Failed to publish report");
              } finally {
                setPublishing(false);
              }
            }}
          >
            {publishing ? "Publishing..." : "Publish"}
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
