"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";

export default function WeeklySummariesPage() {
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [deferred, setDeferred] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ data: current }, { data: sug }] = await Promise.all([
        weeklyReportsApi.current(),
        weeklyReportsApi.suggestions(),
      ]);
      setReport(current.data);
      setSuggestions(sug.data.suggestions ?? []);
      setDeferred(sug.data.deferred_hooks ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load weekly summary");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const addAchievement = async () => {
    if (!report || !title.trim()) return;
    await weeklyReportsApi.addItem(report.id, {
      section_type: "achievement",
      title: title.trim(),
    });
    setTitle("");
    await reload();
  };

  const submit = async () => {
    if (!report) return;
    await weeklyReportsApi.submit(report.id);
    await reload();
  };

  const include = async (s: Record<string, unknown>) => {
    if (!report) return;
    await weeklyReportsApi.includeSuggestion(report.id, {
      source_type: s.source_type,
      source_id: s.source_id,
      suggested_section: s.suggested_section,
      title: s.title,
      reference: s.reference,
      status: s.status,
      confidentiality: s.confidentiality,
    });
    await reload();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My Weekly Summary</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Reuse Assignments and other sources as suggestions — you confirm what is submitted.
          </p>
        </div>
        {report && (
          <Link className="text-sm text-emerald-800 underline" href={`/weekly-summaries/${report.id}`}>
            Open detail
          </Link>
        )}
      </div>

      {error && <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>}
      {busy && <p className="text-sm text-neutral-500">Loading…</p>}

      {report && (
        <section className="space-y-2 border-b border-neutral-200 pb-4">
          <p className="text-sm">
            <span className="font-medium">{report.reference}</span> · {report.status}
            {report.period ? ` · ${report.period.start_date} → ${report.period.end_date}` : null}
          </p>
          <div className="flex flex-wrap gap-2">
            <input
              className="min-w-[240px] flex-1 rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Add key achievement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <button
              type="button"
              onClick={() => void addAchievement()}
              className="rounded bg-emerald-800 px-3 py-2 text-sm text-white"
            >
              Add achievement
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              className="rounded border border-emerald-800 px-3 py-2 text-sm text-emerald-900"
              disabled={["pending_review", "accepted", "exempted"].includes(report.status)}
            >
              Submit with declaration
            </button>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-medium">Suggestions (not submissions)</h2>
        <ul className="mt-3 space-y-2">
          {suggestions.map((s) => (
            <li key={`${s.source_type}-${s.source_id}`} className="flex items-center justify-between gap-3 rounded border border-neutral-200 px-3 py-2">
              <div>
                <p className="text-sm font-medium">{String(s.title)}</p>
                <p className="text-xs text-neutral-500">
                  {String(s.source_type)} · {String(s.suggested_section)} · {String(s.confidentiality)}
                  {s.decision ? ` · ${String(s.decision)}` : ""}
                </p>
              </div>
              {s.decision !== "included" && (
                <button type="button" className="text-sm text-emerald-800 underline" onClick={() => void include(s)}>
                  Include
                </button>
              )}
            </li>
          ))}
          {suggestions.length === 0 && <li className="text-sm text-neutral-500">No suggestions for this period.</li>}
        </ul>
        {deferred.length > 0 && (
          <p className="mt-3 text-xs text-amber-800">
            Timesheets suggestion hook deferred until Timesheets Phase 1 ships.
          </p>
        )}
      </section>
    </div>
  );
}
