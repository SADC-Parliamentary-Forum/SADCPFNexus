"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { assignmentsApi, weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { formatDateRange, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useToast } from "@/components/ui/Toast";
import { ModuleHubCards } from "@/components/ui/ModuleHubCards";
import { WEEKLY_SUMMARIES_HUB_CARDS } from "@/lib/hubs/weeklySummaries";
import { canReviewWeeklySummaries, getStoredUser } from "@/lib/auth";

type AssignmentFeedItem = {
  id: number;
  reference_number?: string | null;
  title?: string | null;
  status?: string | null;
  due_date?: string | null;
};

type WeeklyAssignmentFeed = {
  period_start?: string;
  period_end?: string;
  completed?: AssignmentFeedItem[];
  active?: AssignmentFeedItem[];
  overdue?: AssignmentFeedItem[];
  blocked?: AssignmentFeedItem[];
  upcoming_deadlines?: AssignmentFeedItem[];
  counts?: Record<string, number>;
};

type FeedTab = "completed" | "active" | "overdue" | "blocked" | "upcoming";

const ITEM_SECTIONS = [
  { value: "achievement", label: "Achievement" },
  { value: "wip", label: "Work in progress" },
  { value: "meeting", label: "Meeting" },
  { value: "note", label: "Note" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  pending_review: "Submitted",
  returned_for_correction: "Returned for correction",
  accepted: "Accepted",
  exempted: "Exempted",
  no_report_required: "Not required",
  published: "Published",
};

const STATUS_BADGE: Record<string, string> = {
  draft: "badge-muted",
  in_progress: "badge-primary",
  pending_review: "badge-warning",
  returned_for_correction: "badge-danger",
  accepted: "badge-success",
  exempted: "badge-muted",
  no_report_required: "badge-muted",
  published: "badge-success",
};

const LOCKED_STATUSES = ["pending_review", "accepted", "exempted", "no_report_required", "published"];

const DECLARATION =
  "I confirm that this weekly summary is accurate to the best of my knowledge and is ready for my supervisor to review.";

const FEED_TABS: { key: FeedTab; label: string; rows: (feed: WeeklyAssignmentFeed) => unknown }[] = [
  { key: "completed", label: "Completed", rows: (feed) => feed.completed },
  { key: "active", label: "Active", rows: (feed) => feed.active },
  { key: "overdue", label: "Overdue", rows: (feed) => feed.overdue },
  { key: "blocked", label: "Blocked", rows: (feed) => feed.blocked },
  { key: "upcoming", label: "Upcoming", rows: (feed) => feed.upcoming_deadlines },
];

function asFeedItems(value: unknown): AssignmentFeedItem[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is AssignmentFeedItem =>
    Boolean(row && typeof row === "object" && "id" in row),
  );
}

function errorMessage(e: unknown, fallback: string): string {
  const ax = e as { response?: { data?: { message?: string } }; message?: string };
  return ax.response?.data?.message ?? (e instanceof Error ? e.message : fallback);
}

function sectionLabel(value: unknown): string {
  const key = typeof value === "string" ? value : "";
  return ITEM_SECTIONS.find((s) => s.value === key)?.label ?? (key ? key.replace(/_/g, " ") : "—");
}

function sourceLabel(value: unknown): string {
  const key = String(value ?? "");
  if (key === "calendar_meeting") return "Meeting";
  if (key === "meeting_decision") return "Decision";
  if (key === "assignment") return "Assignment";
  return key.replace(/_/g, " ") || "Suggestion";
}

export default function WeeklySummariesPage() {
  const { success, error: showError } = useToast();
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [feed, setFeed] = useState<WeeklyAssignmentFeed | null>(null);
  const [feedTab, setFeedTab] = useState<FeedTab>("overdue");
  const [suggestions, setSuggestions] = useState<Array<Record<string, unknown>>>([]);
  const [deferred, setDeferred] = useState<Array<Record<string, unknown>>>([]);
  const [title, setTitle] = useState("");
  const [narrative, setNarrative] = useState("");
  const [sectionType, setSectionType] = useState<(typeof ITEM_SECTIONS)[number]["value"]>("achievement");
  const [notes, setNotes] = useState("");
  const [donorCode, setDonorCode] = useState("");
  const [donorName, setDonorName] = useState("");
  const [templateKey, setTemplateKey] = useState("");
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [declared, setDeclared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const feedTabReady = useRef(false);
  const showSpecialistTools = canReviewWeeklySummaries(getStoredUser());

  const reload = async () => {
    setBusy(true);
    setError(null);
    try {
      const [{ data: current }, { data: sug }] = await Promise.all([
        weeklyReportsApi.current(),
        weeklyReportsApi.suggestions(),
      ]);
      const period = current.data.period;
      try {
        const { data: feedPayload } = await assignmentsApi.weeklySummaryFeed(
          period ? { period_start: period.start_date, period_end: period.end_date } : undefined,
        );
        const nextFeed = feedPayload as WeeklyAssignmentFeed;
        setFeed(nextFeed);
        if (!feedTabReady.current) {
          if ((nextFeed.counts?.overdue ?? 0) > 0) setFeedTab("overdue");
          else if ((nextFeed.counts?.active ?? 0) > 0) setFeedTab("active");
          else setFeedTab("completed");
          feedTabReady.current = true;
        }
      } catch {
        setFeed(null);
      }
      setReport(current.data);
      setNotes(current.data.additional_notes ?? "");
      setDonorCode((current.data as WeeklyOpsReport & { donor_code?: string }).donor_code ?? "");
      setDonorName((current.data as WeeklyOpsReport & { donor_name?: string }).donor_name ?? "");
      setTemplateKey((current.data as WeeklyOpsReport & { template_key?: string }).template_key ?? "");
      setAiDraft((current.data as WeeklyOpsReport & { ai_draft_text?: string | null }).ai_draft_text ?? null);
      setSuggestions(sug.data.suggestions ?? []);
      setDeferred(sug.data.deferred_hooks ?? []);
    } catch (e: unknown) {
      setError(errorMessage(e, "Failed to load weekly summary"));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const editable = report ? !LOCKED_STATUSES.includes(report.status) : false;
  const items = (report?.items ?? []) as Array<Record<string, unknown>>;
  const pendingSuggestions = suggestions.filter((s) => s.decision !== "included" && s.decision !== "excluded");

  const feedRows = useMemo(() => {
    if (!feed) return [];
    const tab = FEED_TABS.find((t) => t.key === feedTab);
    return asFeedItems(tab ? tab.rows(feed) : []);
  }, [feed, feedTab]);

  const run = async (label: string, action: () => Promise<void>) => {
    setSaving(true);
    try {
      await action();
      success(label);
    } catch (e: unknown) {
      showError(errorMessage(e, label));
    } finally {
      setSaving(false);
    }
  };

  const addItem = async () => {
    if (!report || !title.trim()) return;
    await run("Entry added.", async () => {
      await weeklyReportsApi.addItem(report.id, {
        section_type: sectionType,
        title: title.trim(),
        narrative: narrative.trim() || null,
      });
      setTitle("");
      setNarrative("");
      await reload();
    });
  };

  const saveDonorTemplate = async () => {
    if (!report) return;
    await run("Donor and template saved.", async () => {
      await weeklyReportsApi.update(report.id, {
        donor_code: donorCode || null,
        donor_name: donorName || null,
        template_key: templateKey || null,
      });
      await reload();
    });
  };

  const saveNotes = async () => {
    if (!report) return;
    await run("Notes saved.", async () => {
      await weeklyReportsApi.update(report.id, { additional_notes: notes.trim() || null });
      await reload();
    });
  };

  const submit = async () => {
    if (!report || !declared) return;
    await run("Weekly summary submitted.", async () => {
      await weeklyReportsApi.submit(report.id);
      setDeclared(false);
      await reload();
    });
  };

  const include = async (s: Record<string, unknown>) => {
    if (!report) return;
    await run("Suggestion included.", async () => {
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
    });
  };

  const skip = async (s: Record<string, unknown>) => {
    if (!report) return;
    await run("Suggestion skipped.", async () => {
      await weeklyReportsApi.excludeSuggestion(report.id, {
        source_type: s.source_type,
        source_id: s.source_id,
        suggested_section: s.suggested_section,
      });
      await reload();
    });
  };

  const generateDraft = async () => {
    if (!report) return;
    await run("Draft generated. Confirm it before it is added to notes.", async () => {
      const res = await weeklyReportsApi.generateAiDraft(report.id);
      setAiDraft(res.data.data.draft);
      await reload();
    });
  };

  const confirmDraft = async () => {
    if (!report) return;
    await run("Draft added to notes.", async () => {
      await weeklyReportsApi.confirmAiDraft(report.id);
      await reload();
    });
  };

  const periodLabel = report?.period
    ? formatDateRange(report.period.start_date, report.period.end_date)
    : "Current period";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <ModulePageHeader
        title="My Weekly Summary"
        subtitle="Add what you did this week, confirm suggested items, then submit for review. Nothing is sent until you declare and submit."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Weekly Summaries" }]} />}
        meta={
          report ? (
            <>
              <span className="font-mono text-xs text-neutral-400">{report.reference}</span>
              <span className={`badge ${STATUS_BADGE[report.status] ?? "badge-muted"}`}>
                {STATUS_LABEL[report.status] ?? report.status.replace(/_/g, " ")}
              </span>
            </>
          ) : null
        }
        actions={
          report ? (
            <>
              <Link href={`/weekly-summaries/${report.id}`} className="btn-secondary text-sm">
                Open detail
              </Link>
              <a href={weeklyReportsApi.exportUrl(report.id, "word")} className="btn-secondary text-sm">
                Export Word
              </a>
            </>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}
      {busy && !report ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {report ? (
        <FormSection
          title="This week"
          description={`${periodLabel}${report.period?.employee_due_at ? ` · due ${formatDateShort(report.period.employee_due_at)}` : ""}`}
          icon="edit_calendar"
        >
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-neutral-400">Period</dt>
              <dd className="mt-0.5 font-medium text-neutral-800">{periodLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Status</dt>
              <dd className="mt-0.5 font-medium text-neutral-800">
                {STATUS_LABEL[report.status] ?? report.status.replace(/_/g, " ")}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-neutral-400">Entries</dt>
              <dd className="mt-0.5 font-medium text-neutral-800">{items.length}</dd>
            </div>
          </dl>
        </FormSection>
      ) : null}

      {report ? (
        <FormSection
          title="Your entries"
          description={
            editable
              ? "Add achievements, work in progress, meetings, or notes. They stay on this draft until you submit."
              : "This summary is no longer editable."
          }
          icon="list"
        >
          {items.length === 0 ? (
            <p className="mb-4 text-sm text-neutral-500">Nothing added yet. Start with one entry below, or include a suggestion.</p>
          ) : (
            <div className="mb-5 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-neutral-100 text-neutral-500">
                    <th className="py-2 pr-3 font-medium">Section</th>
                    <th className="py-2 pr-3 font-medium">Title</th>
                    <th className="py-2 font-medium">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr key={String(item.id ?? index)} className="border-b border-neutral-50 align-top">
                      <td className="py-2 pr-3 capitalize">{sectionLabel(item.section_type)}</td>
                      <td className="py-2 pr-3 font-medium">{labelledObjectCell(item.title)}</td>
                      <td className="py-2 text-neutral-600">{labelledObjectCell(item.narrative)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {editable ? (
            <div className="space-y-3 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
              <div className="grid gap-3 sm:grid-cols-[11rem_1fr]">
                <FormField label="Section" htmlFor="weekly-item-section">
                  <select
                    id="weekly-item-section"
                    className="form-input"
                    value={sectionType}
                    onChange={(e) => setSectionType(e.target.value as (typeof ITEM_SECTIONS)[number]["value"])}
                    disabled={saving}
                  >
                    {ITEM_SECTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Title" htmlFor="weekly-item-title" required>
                  <input
                    id="weekly-item-title"
                    className="form-input"
                    placeholder="Short description of what happened"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={saving}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void addItem();
                      }
                    }}
                  />
                </FormField>
              </div>
              <FormField
                label="Detail"
                htmlFor="weekly-item-narrative"
                hint="Optional. Outcome, next step, or context for your supervisor."
              >
                <textarea
                  id="weekly-item-narrative"
                  className="form-input min-h-[72px]"
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  disabled={saving}
                />
              </FormField>
              <button
                type="button"
                onClick={() => void addItem()}
                className="btn-primary text-sm disabled:opacity-50"
                disabled={saving || !title.trim()}
              >
                Add entry
              </button>
            </div>
          ) : null}
        </FormSection>
      ) : null}

      <FormSection
        title="Suggested from your work"
        description="Include items from assignments, meetings, and decisions. Skipping hides them from this week."
        icon="tips_and_updates"
      >
        {pendingSuggestions.length === 0 ? (
          <p className="text-sm text-neutral-500">
            {suggestions.length === 0 ? "No suggestions for this period." : "All suggestions have been included or skipped."}
          </p>
        ) : (
          <ul className="space-y-2">
            {pendingSuggestions.map((s) => (
              <li
                key={`${s.source_type}-${s.source_id}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    {sourceLabel(s.chip_label ?? s.source_type)}
                    {s.suggested_section ? ` · ${sectionLabel(s.suggested_section)}` : ""}
                  </p>
                  <p className="mt-0.5 text-sm font-medium text-neutral-900">{String(s.title ?? "Untitled")}</p>
                  {s.reference ? (
                    <p className="mt-0.5 text-xs text-neutral-500">{String(s.reference)}</p>
                  ) : null}
                </div>
                {editable ? (
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      className="btn-secondary px-3 py-1.5 text-xs"
                      disabled={saving}
                      onClick={() => void skip(s)}
                    >
                      Skip
                    </button>
                    <button
                      type="button"
                      className="btn-primary px-3 py-1.5 text-xs"
                      disabled={saving}
                      onClick={() => void include(s)}
                    >
                      Include
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
        {deferred.length > 0 ? (
          <p className="mt-3 text-xs text-amber-800">Some source hooks are deferred.</p>
        ) : null}
      </FormSection>

      {feed ? (
        <FormSection
          title="Assignments this week"
          description={`${feed.period_start ? formatDateShort(feed.period_start) : "This period"} → ${feed.period_end ? formatDateShort(feed.period_end) : "now"}. Open a row to see the assignment.`}
          icon="task_alt"
        >
          <div data-testid="weekly-assignment-feed" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {FEED_TABS.map((tab) => {
                const count = feed.counts?.[tab.key] ?? 0;
                const active = feedTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setFeedTab(tab.key)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      active ? "border-primary bg-primary/5 text-primary" : "border-neutral-200 text-neutral-700"
                    }`}
                  >
                    <span className="block text-[11px] uppercase tracking-wide opacity-70">{tab.label}</span>
                    <span className="text-base font-semibold">{count}</span>
                  </button>
                );
              })}
            </div>
            {feedRows.length === 0 ? (
              <p className="text-sm text-neutral-500">None in this list.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Reference</th>
                      <th className="py-2 pr-3 font-medium">Title</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 font-medium">Due</th>
                    </tr>
                  </thead>
                  <tbody>
                    {feedRows.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">
                          <Link href={`/assignments/${row.id}`} className="font-medium text-primary hover:underline">
                            {row.reference_number ?? row.id}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">{row.title ?? "—"}</td>
                        <td className="py-2 pr-3 capitalize">{row.status?.replace(/_/g, " ") ?? "—"}</td>
                        <td className="py-2">{formatDateShort(row.due_date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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

      {report ? (
        <FormSection
          title="Donor and template"
          description="Optional. Use when this week should follow a donor or project format."
          icon="handshake"
        >
          <div className="grid gap-3 md:grid-cols-3">
            <FormField label="Donor code" htmlFor="donor-code">
              <input
                id="donor-code"
                className="form-input"
                value={donorCode}
                onChange={(e) => setDonorCode(e.target.value)}
                disabled={!editable || saving}
              />
            </FormField>
            <FormField label="Donor / project name" htmlFor="donor-name">
              <input
                id="donor-name"
                className="form-input"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                disabled={!editable || saving}
              />
            </FormField>
            <FormField label="Template" htmlFor="template-key">
              <select
                id="template-key"
                className="form-input"
                value={templateKey}
                onChange={(e) => setTemplateKey(e.target.value)}
                disabled={!editable || saving}
              >
                <option value="">None</option>
                <option value="standard">Standard</option>
                <option value="donor_progress">Donor progress</option>
                <option value="project_update">Project update</option>
              </select>
            </FormField>
          </div>
          {editable ? (
            <button
              type="button"
              onClick={() => void saveDonorTemplate()}
              className="btn-secondary mt-4 text-sm disabled:opacity-50"
              disabled={saving}
            >
              Save donor and template
            </button>
          ) : null}
        </FormSection>
      ) : null}

      {report ? (
        <FormSection title="Notes" description="Anything else your supervisor should see." icon="notes">
          <FormField label="Additional notes" htmlFor="weekly-notes">
            <textarea
              id="weekly-notes"
              className="form-input min-h-[96px]"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!editable || saving}
            />
          </FormField>
          {editable ? (
            <button
              type="button"
              onClick={() => void saveNotes()}
              className="btn-secondary mt-3 text-sm disabled:opacity-50"
              disabled={saving}
            >
              Save notes
            </button>
          ) : null}
        </FormSection>
      ) : null}

      {report ? (
        <FormSection
          title="Submit for review"
          description="Submitting sends this digest to your supervisor. You can still export a Word copy afterwards."
          icon="send"
        >
          {editable ? (
            <div className="space-y-4">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-neutral-200 bg-white p-4">
                <input
                  type="checkbox"
                  className="mt-1 rounded border-neutral-300"
                  checked={declared}
                  onChange={(e) => setDeclared(e.target.checked)}
                  disabled={saving}
                />
                <span className="text-sm text-neutral-800">{DECLARATION}</span>
              </label>
              <button
                type="button"
                data-testid="weekly-submit"
                onClick={() => void submit()}
                className="btn-primary text-sm disabled:opacity-50"
                disabled={saving || !declared}
              >
                Submit with declaration
              </button>
            </div>
          ) : (
            <p className="text-sm text-neutral-600">
              This summary is {STATUS_LABEL[report.status] ?? report.status.replace(/_/g, " ")}. It cannot be submitted again.
            </p>
          )}
        </FormSection>
      ) : null}

      {report ? (
        <FormSection
          title="Optional AI draft"
          description="Never auto-submits. Confirming appends draft text to notes only."
          icon="smart_toy"
          actions={
            editable ? (
              <div className="flex gap-2">
                <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={() => void generateDraft()}>
                  Generate draft
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={() => void confirmDraft()}
                  disabled={!aiDraft || saving}
                >
                  Confirm draft
                </button>
              </div>
            ) : null
          }
        >
          {aiDraft ? (
            <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-neutral-50 p-3 text-xs text-neutral-800">
              {aiDraft}
            </pre>
          ) : (
            <p className="text-sm text-neutral-500">No draft generated yet.</p>
          )}
        </FormSection>
      ) : null}

      {showSpecialistTools ? (
        <details className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold text-neutral-700">More weekly-summary tools</summary>
          <div className="mt-3">
            <ModuleHubCards cards={WEEKLY_SUMMARIES_HUB_CARDS} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
