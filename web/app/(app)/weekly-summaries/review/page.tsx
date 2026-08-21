"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

type PeriodSummary = {
  id?: number;
  reference?: string | null;
  start_date?: string | null;
  end_date?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => Boolean(asRecord(row)));
}

function periodLabel(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return "—";
  const ref = rec.reference != null && rec.reference !== "" ? String(rec.reference) : "";
  const start = rec.start_date != null && rec.start_date !== "" ? String(rec.start_date) : "";
  const end = rec.end_date != null && rec.end_date !== "" ? String(rec.end_date) : "";
  const range = start && end ? `${start} → ${end}` : start || end;
  return [ref, range].filter(Boolean).join(" · ") || "—";
}

function ownerLabel(row: Record<string, unknown>): unknown {
  if (typeof row.employee_name === "string" && row.employee_name.trim()) return row.employee_name;
  if (row.employee) return row.employee;
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  if (row.employee_id != null && row.employee_id !== "") return `Person #${row.employee_id}`;
  return "Unknown owner";
}

function personLabel(row: Record<string, unknown>): unknown {
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  if (row.id != null && row.id !== "") return `Person #${row.id}`;
  return "Unknown person";
}

function reportId(row: Record<string, unknown>): number | null {
  const id = typeof row.id === "number" ? row.id : Number(row.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export default function WeeklySummariesReviewPage() {
  const [pendingCount, setPendingCount] = useState(0);
  const [queue, setQueue] = useState<Record<string, unknown>[]>([]);
  const [missing, setMissing] = useState<Record<string, unknown>[]>([]);
  const [period, setPeriod] = useState<PeriodSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    setError(null);
    try {
      const { data } = await weeklyReportsApi.dashboard();
      const payload = (data.data ?? {}) as Record<string, unknown>;
      const pendingReports = asRows(payload.team_pending_reports);
      setPendingCount(Number(payload.team_pending_review ?? pendingReports.length ?? 0));
      setQueue(pendingReports);
      setMissing(asRows(payload.missing_reports));
      setPeriod(asRecord(payload.period) as PeriodSummary | null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load the review queue");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Team review"
        subtitle="Submitted weekly summaries waiting for supervisor review. Accept and return happen on the report detail page — this queue never auto-accepts."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Team review" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error.startsWith("Failed to load") ? error : `Failed to load the review queue: ${error}`}
        </div>
      ) : null}

      {busy ? (
        <div className="card space-y-3 p-6" aria-busy="true">
          <p className="text-sm text-neutral-500">Loading…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {!busy && !error ? (
        <>
          <FormSection
            title="Review metrics"
            description="Honest counts from the current-period dashboard. This page does not invent sign-off or UAT status."
            icon="monitoring"
          >
            <LabelledRecord
              value={{
                pending_review: pendingCount,
                missing_reports: missing.length,
                period: periodLabel(period),
              }}
            />
          </FormSection>

          <FormSection
            title="Pending review queue"
            description="Open a report to accept or return it. Accept and return stay on the detail page so there is one authority path."
            icon="rate_review"
          >
            {queue.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No reports pending review"
                description="Submitted summaries for your team will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Pending weekly summaries</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Reference</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queue.map((row, idx) => {
                      const id = reportId(row);
                      return (
                        <tr key={id ?? `pending-${idx}`} className="border-b border-neutral-50">
                          <td className="py-2 pr-3">
                            {id ? (
                              <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary hover:underline">
                                {String(row.reference ?? `#${id}`)}
                              </Link>
                            ) : (
                              labelledObjectCell(row.reference ?? "—")
                            )}
                          </td>
                          <td className="py-2 pr-3">{labelledObjectCell(ownerLabel(row))}</td>
                          <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                          <td className="py-2 capitalize">{labelledObjectCell(row.status ?? "—")}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Missing reports"
            description="People in scope who have not submitted for this period."
            icon="person_off"
          >
            {missing.length === 0 ? (
              <EmptyState
                icon="check_circle"
                title="No missing reports"
                description="None listed for your scope."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">People missing weekly summaries</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 font-medium">Department</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((row, idx) => (
                      <tr key={row.id != null && row.id !== "" ? String(row.id) : `missing-${idx}`} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{labelledObjectCell(personLabel(row))}</td>
                        <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                        <td className="py-2">{labelledObjectCell(row.department ?? row.department_id ?? "—")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
