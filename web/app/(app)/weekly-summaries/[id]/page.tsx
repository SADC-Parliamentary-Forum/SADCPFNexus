"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";

export default function WeeklySummaryDetailPage() {
  const params = useParams<{ id: string }>();
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const load = async () => {
    try {
      const { data } = await weeklyReportsApi.get(Number(params.id));
      setReport(data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  if (error) return <p className="p-6 text-sm text-red-700">{error}</p>;
  if (!report) return <p className="p-6 text-sm text-neutral-500">Loading…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{report.reference}</h1>
        <p className="text-sm text-neutral-600">
          {report.report_type} · {report.status} · v{report.version}
        </p>
      </header>

      <section>
        <h2 className="text-lg font-medium">Items</h2>
        <ul className="mt-2 space-y-2">
          {(report.items ?? []).map((item) => (
            <li key={String(item.id)} className="rounded border border-neutral-200 px-3 py-2 text-sm">
              <strong>[{String(item.section_type)}]</strong> {String(item.title)}
              {item.narrative ? <p className="text-neutral-600">{String(item.narrative)}</p> : null}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-wrap gap-2">
        <a className="rounded border px-3 py-2 text-sm" href={weeklyReportsApi.exportUrl(report.id, "pdf")}>
          PDF
        </a>
        <a className="rounded border px-3 py-2 text-sm" href={weeklyReportsApi.exportUrl(report.id, "csv")}>
          Excel/CSV
        </a>
        <a className="rounded border px-3 py-2 text-sm" href={weeklyReportsApi.exportUrl(report.id, "word")}>
          Word
        </a>
        <button
          type="button"
          className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
          onClick={async () => {
            await weeklyReportsApi.accept(report.id);
            await load();
          }}
        >
          Accept (supervisor)
        </button>
        <div className="flex gap-2">
          <input
            className="rounded border px-2 text-sm"
            placeholder="Return reason"
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
          />
          <button
            type="button"
            className="rounded border border-amber-700 px-3 py-2 text-sm text-amber-900"
            onClick={async () => {
              await weeklyReportsApi.returnReport(report.id, { reason: returnReason || "Correction required" });
              await load();
            }}
          >
            Return
          </button>
        </div>
      </section>
    </div>
  );
}
