"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";

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
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="My Weekly Summary"
        subtitle="Suggestion chips from assignments, meetings, and decisions — you confirm what is submitted. AI draft never auto-submits."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Weekly Summaries" }]} />}
        actions={
          report ? (
            <Link href={`/weekly-summaries/${report.id}`} className="btn-secondary text-sm">
              Open detail
            </Link>
          ) : null
        }
      />

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div> : null}
      {busy && !report ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {report ? (
        <FormSection
          title="Current period"
          description={`${report.reference} · ${report.status}${report.period ? ` · ${report.period.start_date} → ${report.period.end_date}` : ""}`}
          icon="edit_calendar"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Donor code" htmlFor="donor-code">
              <input
                id="donor-code"
                className="form-input"
                placeholder="Donor code"
                value={donorCode}
                onChange={(e) => setDonorCode(e.target.value)}
              />
            </FormField>
            <FormField label="Donor / project name" htmlFor="donor-name">
              <input
                id="donor-name"
                className="form-input"
                placeholder="Donor / project name"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
              />
            </FormField>
            <FormField label="Template" htmlFor="template-key">
              <select
                id="template-key"
                className="form-input"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
              >
                <option value="">Template (optional)</option>
                <option value="standard">Standard</option>
                <option value="donor_progress">Donor progress</option>
                <option value="project_update">Project update</option>
              </select>
            </FormField>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => void saveDonorTemplate()} className="btn-secondary text-sm">
              Save donor/template
            </button>
            <input
              className="form-input min-w-[240px] flex-1"
              placeholder="Add key achievement"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              aria-label="Achievement title"
            />
            <button type="button" onClick={() => void addAchievement()} className="btn-primary text-sm">
              Add achievement
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              className="btn-secondary text-sm"
              disabled={["pending_review", "accepted", "exempted"].includes(report.status)}
            >
              Submit with declaration
            </button>
          </div>
        </FormSection>
      ) : null}

      {!busy && !report && !error ? (
        <div className="card">
          <EmptyState
            icon="edit_calendar"
            title="No weekly summary"
            description="Your current period summary will appear here when available."
          />
        </div>
      ) : null}

      <FormSection title="Suggestion chips" description="Confirm to include items in your submission." icon="tips_and_updates">
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={`${s.source_type}-${s.source_id}`}
              type="button"
              disabled={s.decision === "included"}
              onClick={() => void include(s)}
              className={`rounded-lg border px-3 py-1.5 text-left text-xs ${chipClass(String(s.source_type))} ${
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
        {deferred.length > 0 ? (
          <p className="mt-3 text-xs text-amber-800">Some source hooks are deferred.</p>
        ) : null}
      </FormSection>

      {report ? (
        <FormSection
          title="Optional AI draft stub"
          description="Never auto-submits. Human confirmation only appends draft text to notes."
          icon="smart_toy"
          actions={
            <div className="flex gap-2">
              <button type="button" className="btn-secondary text-sm" onClick={() => void generateDraft()}>
                Generate draft
              </button>
              <button
                type="button"
                className="btn-primary text-sm"
                onClick={() => void confirmDraft()}
                disabled={!aiDraft}
              >
                Confirm draft
              </button>
            </div>
          }
        >
          {aiDraft ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs text-neutral-800">{aiDraft}</pre>
          ) : (
            <p className="text-sm text-neutral-500">No draft generated yet.</p>
          )}
        </FormSection>
      ) : null}
    </div>
  );
}
