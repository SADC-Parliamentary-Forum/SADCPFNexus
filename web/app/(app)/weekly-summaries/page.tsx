"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";

export default function WeeklySummariesPage() {
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [deferred, setDeferred] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState("");
  const [donorCode, setDonorCode] = useState("");
  const [donorName, setDonorName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
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
      setDonorCode((current.data as WeeklyOpsReport & { donor_code?: string }).donor_code ?? "");
      setDonorName((current.data as WeeklyOpsReport & { donor_name?: string }).donor_name ?? "");
      setTemplateKey((current.data as WeeklyOpsReport & { template_key?: string }).template_key ?? "");
      setAiDraft((current.data as WeeklyOpsReport & { ai_draft_text?: string | null }).ai_draft_text ?? null);
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

  const saveDonorTemplate = async () => {
    if (!report) return;
    await weeklyReportsApi.update(report.id, {
      donor_code: donorCode || null,
      donor_name: donorName || null,
      template_key: templateKey || null,
    });
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

  const generateDraft = async () => {
    if (!report) return;
    const res = await weeklyReportsApi.generateAiDraft(report.id);
    setAiDraft(res.data.data.draft);
    await reload();
  };

  const confirmDraft = async () => {
    if (!report) return;
    await weeklyReportsApi.confirmAiDraft(report.id);
    await reload();
  };

  const chipClass = (sourceType: string) => {
    if (sourceType === "calendar_meeting") return "bg-sky-50 text-sky-800 border-sky-200";
    if (sourceType === "meeting_decision") return "bg-violet-50 text-violet-800 border-violet-200";
    if (sourceType === "assignment") return "bg-emerald-50 text-emerald-800 border-emerald-200";
    return "bg-neutral-50 text-neutral-700 border-neutral-200";
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-neutral-900">My Weekly Summary</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Suggestion chips from assignments, meetings, and decisions — you confirm what is submitted. AI draft never auto-submits.
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
        <section className="space-y-3 border-b border-neutral-200 pb-4">
          <p className="text-sm">
            <span className="font-medium">{report.reference}</span> · {report.status}
            {report.period ? ` · ${report.period.start_date} → ${report.period.end_date}` : null}
          </p>
          <div className="grid gap-2 md:grid-cols-3">
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Donor code"
              value={donorCode}
              onChange={(e) => setDonorCode(e.target.value)}
            />
            <input
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              placeholder="Donor / project name"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
            />
            <select
              className="rounded border border-neutral-300 px-3 py-2 text-sm"
              value={templateKey}
              onChange={(e) => setTemplateKey(e.target.value)}
            >
              <option value="">Template (optional)</option>
              <option value="standard">Standard</option>
              <option value="donor_progress">Donor progress</option>
              <option value="project_update">Project update</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveDonorTemplate()} className="rounded border border-neutral-300 px-3 py-2 text-sm">
              Save donor/template
            </button>
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
        <h2 className="text-lg font-medium">Suggestion chips (confirm to include)</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={`${s.source_type}-${s.source_id}`}
              type="button"
              disabled={s.decision === "included"}
              onClick={() => void include(s)}
              className={`rounded-full border px-3 py-1.5 text-left text-xs ${chipClass(String(s.source_type))} ${
                s.decision === "included" ? "opacity-60" : "hover:shadow-sm"
              }`}
              title={String(s.title)}
            >
              <span className="font-semibold">{String(s.chip_label ?? s.source_type)}</span>
              <span className="ml-1">{String(s.title).slice(0, 48)}</span>
              {s.decision === "included" ? " ✓" : ""}
            </button>
          ))}
          {suggestions.length === 0 && <p className="text-sm text-neutral-500">No suggestions for this period.</p>}
        </div>
        {deferred.length > 0 && (
          <p className="mt-3 text-xs text-amber-800">Some source hooks are deferred.</p>
        )}
      </section>

      {report && (
        <section className="space-y-2 rounded border border-neutral-200 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-medium">Optional AI draft stub</h2>
            <div className="flex gap-2">
              <button type="button" className="rounded border border-neutral-300 px-3 py-1.5 text-sm" onClick={() => void generateDraft()}>
                Generate draft
              </button>
              <button
                type="button"
                className="rounded bg-neutral-900 px-3 py-1.5 text-sm text-white"
                onClick={() => void confirmDraft()}
                disabled={!aiDraft}
              >
                Confirm draft (does not submit)
              </button>
            </div>
          </div>
          <p className="text-xs text-neutral-500">Never auto-submits. Human confirmation only appends draft text to notes.</p>
          {aiDraft && (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-neutral-50 p-3 text-xs text-neutral-800">{aiDraft}</pre>
          )}
        </section>
      )}
    </div>
  );
}
