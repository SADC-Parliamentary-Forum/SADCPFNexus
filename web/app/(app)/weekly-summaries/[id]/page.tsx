"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export default function WeeklySummaryDetailPage() {
  const params = useParams<{ id: string }>();
  const { toast } = useToast();
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [accepting, setAccepting] = useState(false);
  const [returning, setReturning] = useState(false);
  const [busy, setBusy] = useState(true);

  const load = async () => {
    const id = Number(params.id);
    if (!Number.isFinite(id) || id <= 0) {
      setError("Failed to load");
      setReport(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    try {
      const { data } = await weeklyReportsApi.get(id);
      setReport(data.data);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setReport(null);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.id]);

  const items = (report?.items ?? []) as Array<Record<string, unknown>>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <ModulePageHeader
        title={report?.reference ?? "Weekly summary"}
        subtitle="Open a submitted digest, export it, or return it with a labelled reason. Accept and return never run automatically."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: report?.reference ?? "Detail" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {busy && !report ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">Loading…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {report ? (
        <>
          <FormSection title="Report" description="Status and period for this digest." icon="description">
            <LabelledRecord
              value={{
                reference: report.reference,
                type: report.report_type,
                status: report.status,
                version: report.version,
                period: report.period
                  ? `${report.period.reference} · ${formatDateShort(report.period.start_date)} → ${formatDateShort(report.period.end_date)}`
                  : "—",
              }}
            />
          </FormSection>

          <FormSection title="Items" description="Achievements, priorities, and other sections on this digest." icon="list">
            {items.length === 0 ? (
              <EmptyState
                icon="notes"
                title="No items on this digest"
                description="Nothing has been added to this weekly summary yet."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="p-2">Section</th>
                      <th className="p-2">Title</th>
                      <th className="p-2">Narrative</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item, index) => {
                      const rec = asRecord(item) ?? item;
                      return (
                        <tr key={String(rec.id ?? index)} className="border-t border-neutral-200">
                          <td className="p-2">{labelledObjectCell(rec.section_type)}</td>
                          <td className="p-2 font-medium">{labelledObjectCell(rec.title)}</td>
                          <td className="p-2 text-neutral-600">{labelledObjectCell(rec.narrative)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Supervisor review"
            description="Accept or return this digest. Return requires a labelled reason."
            icon="rule"
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <FormField label="Return reason" htmlFor="weekly-return-reason">
                <input
                  id="weekly-return-reason"
                  className="form-input"
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  disabled={returning}
                />
              </FormField>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={accepting}
                  onClick={async () => {
                    if (accepting) return;
                    setAccepting(true);
                    try {
                      await weeklyReportsApi.accept(report.id);
                      await load();
                    } catch (e: unknown) {
                      toast("error", e instanceof Error ? e.message : "Failed to accept report");
                    } finally {
                      setAccepting(false);
                    }
                  }}
                >
                  {accepting ? "Accepting..." : "Accept (supervisor)"}
                </button>
                <button
                  type="button"
                  className="btn-secondary text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={returning}
                  onClick={async () => {
                    if (returning) return;
                    setReturning(true);
                    try {
                      await weeklyReportsApi.returnReport(report.id, {
                        reason: returnReason.trim() || "Correction required",
                      });
                      setReturnReason("");
                      await load();
                    } catch (e: unknown) {
                      toast("error", e instanceof Error ? e.message : "Failed to return report");
                    } finally {
                      setReturning(false);
                    }
                  }}
                >
                  {returning ? "Returning..." : "Return"}
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection title="Export" description="Download this digest. The management pack includes the assignment feed and emerging-risk counts. Exports do not change status and are not auto-sent." icon="download">
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "pdf")}>
                PDF
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "csv")}>
                Excel/CSV
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "word")}>
                Word
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "management-pack")}>
                Management pack
              </a>
            </div>
          </FormSection>
        </>
      ) : null}

      {!busy && !report && !error ? (
        <EmptyState
          icon="description"
          title="Weekly summary not found"
          description="This digest could not be opened."
        />
      ) : null}
    </div>
  );
}
