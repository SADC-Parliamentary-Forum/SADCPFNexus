"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { reportsApi, weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

type PeriodRow = {
  id?: number;
  reference?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
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

function dateLabel(value: unknown): string {
  if (value == null || value === "") return "";
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function periodLabel(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return "—";
  const ref = rec.reference != null && rec.reference !== "" ? String(rec.reference) : "";
  const start = dateLabel(rec.start_date);
  const end = dateLabel(rec.end_date);
  const range = start && end ? `${start} → ${end}` : start || end;
  return [ref, range].filter(Boolean).join(" · ") || "Current period";
}

function numericId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function departmentName(
  row: Record<string, unknown>,
  departments: Array<{ id: number; name: string }>,
): string {
  if (typeof row.department === "string" && row.department.trim()) return row.department;
  const nested = asRecord(row.department);
  if (nested) {
    const labelled = nested.name ?? nested.title ?? nested.label;
    if (labelled != null && labelled !== "") return String(labelled);
  }
  const deptId = numericId(row.department_id);
  const match = deptId ? departments.find((d) => d.id === deptId) : undefined;
  if (match?.name) return match.name;
  return "Unassigned";
}

function itemTitle(row: Record<string, unknown>): string {
  const title = row.title ?? row.narrative ?? row.reference;
  return title != null && title !== "" ? String(title) : "Consolidated item";
}

function sourceReportId(row: Record<string, unknown>): number | null {
  const structured = asRecord(row.structured);
  return numericId(structured?.source_report_id) ?? numericId(row.source_report_id);
}

export default function WeeklyInstitutionalPage() {
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [periodId, setPeriodId] = useState("");
  const [departments, setDepartments] = useState<Array<{ id: number; name: string }>>([]);
  const [missing, setMissing] = useState<Record<string, unknown>[]>([]);
  const [currentPeriodId, setCurrentPeriodId] = useState<number | null>(null);
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setBusy(true);
      setError(null);
      try {
        const [{ data: periodPayload }, { data: dashPayload }, deptResult] = await Promise.all([
          weeklyReportsApi.periods(),
          weeklyReportsApi.dashboard(),
          reportsApi.departments().catch(() => null),
        ]);
        if (cancelled) return;

        const dash = asRecord(dashPayload.data) ?? {};
        const dashPeriod = asRecord(dash.period);
        let periodRows = asRows(periodPayload.data) as PeriodRow[];
        const dashPeriodId = numericId(dashPeriod?.id);
        if (dashPeriod && dashPeriodId && !periodRows.some((row) => numericId(row.id) === dashPeriodId)) {
          periodRows = [dashPeriod as PeriodRow, ...periodRows];
        }
        setPeriods(periodRows);
        setMissing(asRows(dash.missing_reports));
        setCurrentPeriodId(dashPeriodId);

        if (deptResult) {
          setDepartments(
            asRows(deptResult.data.data).map((row) => ({
              id: numericId(row.id) ?? 0,
              name: String(row.name ?? row.code ?? "Department"),
            })).filter((row) => row.id > 0),
          );
        }

        const selected = dashPeriodId ?? numericId(periodRows[0]?.id);
        setPeriodId(selected ? String(selected) : "");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load institutional summary");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    };
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!periodId) {
      setReport(null);
      return;
    }
    let cancelled = false;
    const loadReport = async () => {
      setLoadingReport(true);
      setError(null);
      try {
        const { data } = await weeklyReportsApi.institutional(Number(periodId));
        if (!cancelled) setReport(data.data);
      } catch (e: unknown) {
        if (!cancelled) {
          setReport(null);
          setError(e instanceof Error ? e.message : "Failed to load institutional summary");
        }
      } finally {
        if (!cancelled) setLoadingReport(false);
      }
    };
    void loadReport();
    return () => {
      cancelled = true;
    };
  }, [periodId]);

  const selectedPeriod = useMemo(
    () => periods.find((row) => String(row.id) === periodId) ?? report?.period ?? null,
    [periods, periodId, report],
  );

  const viewingCurrentPeriod = currentPeriodId != null && Number(periodId) === currentPeriodId;
  const items = asRows(report?.items);
  const links = asRows((report as (WeeklyOpsReport & { consolidation_links?: unknown }) | null)?.consolidation_links);

  const unitBreakdown = useMemo(() => {
    const counts = new Map<string, { department: string; missing: number; items: number }>();
    const bump = (label: string, field: "missing" | "items") => {
      const current = counts.get(label) ?? { department: label, missing: 0, items: 0 };
      current[field] += 1;
      counts.set(label, current);
    };
    for (const row of missing) bump(departmentName(row, departments), "missing");
    for (const row of items) {
      const structured = asRecord(row.structured) ?? {};
      bump(departmentName({ ...structured, ...row }, departments), "items");
    }
    return Array.from(counts.values());
  }, [missing, items, departments]);

  const publish = async () => {
    if (!report || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const { data } = await weeklyReportsApi.publish(report.id);
      setReport(data.data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to publish institutional summary");
    } finally {
      setPublishing(false);
    }
  };

  const errorCopy = error
    ? error.startsWith("Failed to load") || error.startsWith("Failed to publish")
      ? error
      : `Failed to load institutional summary: ${error}`
    : null;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Institutional summary"
        subtitle="Tenant rollup for the selected reporting week. Periods are chosen by name and dates — this page never auto-submits or auto-publishes."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Institutional" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {report ? (
              <Link href={`/weekly-summaries/${report.id}`} className="btn-secondary text-sm">
                Open detail
              </Link>
            ) : null}
            <Link href="/weekly-summaries/department" className="btn-secondary text-sm">
              Department view
            </Link>
          </div>
        }
      />

      {errorCopy ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {errorCopy}
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

      {!busy ? (
        <FormSection
          title="Reporting period"
          description="The current tenant week loads automatically. Switch periods by label if you need an earlier week."
          icon="edit_calendar"
        >
          {periods.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="No reporting periods"
              description="Weekly reporting periods for this institution will appear here when they are opened."
            />
          ) : (
            <FormField label="Period" htmlFor="institutional-period" hint="Shown as reference and date range, not a numeric identifier.">
              <select
                id="institutional-period"
                className="form-input max-w-xl"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value="">Select period</option>
                {periods.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {periodLabel(row)}
                    {numericId(row.id) === currentPeriodId ? " · current" : ""}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </FormSection>
      ) : null}

      {!busy && periodId && loadingReport ? (
        <div className="card space-y-3 p-6" aria-busy="true">
          <p className="text-sm text-neutral-500">Loading…</p>
          <div className="h-10 animate-pulse rounded bg-neutral-100" />
        </div>
      ) : null}

      {!busy && !loadingReport && periodId && !report && !error ? (
        <div className="card">
          <EmptyState
            icon="account_balance"
            title="No institutional summary"
            description="The current institution rollup will appear here when you are authorised to open it."
          />
        </div>
      ) : null}

      {!busy && !loadingReport && report ? (
        <>
          <FormSection
            title="Institutional rollup"
            description={`${report.reference} · ${report.status}${selectedPeriod ? ` · ${periodLabel(selectedPeriod)}` : ""}`}
            icon="account_balance"
            actions={
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={publishing || report.status === "published" || report.status === "closed"}
                onClick={() => void publish()}
              >
                {publishing ? "Publishing…" : report.status === "published" ? "Published" : "Publish"}
              </button>
            }
          >
            <LabelledRecord
              value={{
                period: periodLabel(report.period ?? selectedPeriod),
                status: report.status,
                reference: report.reference,
                version: `v${report.version}`,
                published_at: report.published_at ?? "Not published",
              }}
            />
          </FormSection>

          <FormSection
            title="Department / unit breakdown"
            description="Consolidated items and missing submissions grouped by department name."
            icon="account_tree"
          >
            {unitBreakdown.length === 0 ? (
              <EmptyState
                icon="group"
                title="No department breakdown yet"
                description="Items and missing reports for this period will group here by unit name."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Department breakdown for the institutional summary</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 font-medium">Consolidated items</th>
                      <th className="py-2 pr-3 font-medium">Missing reports</th>
                      <th className="py-2 font-medium">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitBreakdown.map((row) => (
                      <tr key={row.department} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{labelledObjectCell(row.department)}</td>
                        <td className="py-2 pr-3">{row.items}</td>
                        <td className="py-2 pr-3">{row.missing}</td>
                        <td className="py-2">
                          <Link href="/weekly-summaries/department" className="font-medium text-primary hover:underline">
                            Department view
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title="Consolidated items"
            description="Snapshots copied into the institutional rollup. Source reports stay unchanged."
            icon="layers"
          >
            {items.length === 0 && links.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No consolidated items"
                description="Selected department and employee items will appear here after they are included."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Items in the institutional weekly summary</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Title</th>
                      <th className="py-2 pr-3 font-medium">Section</th>
                      <th className="py-2 pr-3 font-medium">Source</th>
                      <th className="py-2 font-medium">Report</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items.length > 0 ? items : links).map((row, idx) => {
                      const sourceId = sourceReportId(row) ?? numericId(row.source_report_id);
                      return (
                        <tr key={numericId(row.id) ?? `item-${idx}`} className="border-b border-neutral-50">
                          <td className="py-2 pr-3">{labelledObjectCell(itemTitle(row))}</td>
                          <td className="py-2 pr-3 capitalize">{labelledObjectCell(row.section_type ?? "consolidated")}</td>
                          <td className="py-2 pr-3">
                            {labelledObjectCell(row.source_reference_snapshot ?? row.source_entity_type ?? "—")}
                          </td>
                          <td className="py-2">
                            {sourceId ? (
                              <Link href={`/weekly-summaries/${sourceId}`} className="font-medium text-primary hover:underline">
                                Open source
                              </Link>
                            ) : report ? (
                              <Link href={`/weekly-summaries/${report.id}`} className="font-medium text-primary hover:underline">
                                Open rollup
                              </Link>
                            ) : (
                              "—"
                            )}
                          </td>
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
            description={
              viewingCurrentPeriod
                ? "People in the current tenant week who have not submitted."
                : "Missing-report names are listed for the current tenant week. Switch back to the current period for this list."
            }
            icon="person_off"
          >
            {!viewingCurrentPeriod ? (
              <p className="mb-4 text-sm text-neutral-500">
                Showing current-week missing reports because the dashboard is scoped to the open period.
              </p>
            ) : null}
            {missing.length === 0 ? (
              <EmptyState
                icon="check_circle"
                title="No missing reports"
                description="None listed for the current institution week."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">People missing weekly summaries</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Person</th>
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 font-medium">Period</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missing.map((row, idx) => (
                      <tr
                        key={row.id != null && row.id !== "" ? String(row.id) : `missing-${idx}`}
                        className="border-b border-neutral-50"
                      >
                        <td className="py-2 pr-3">
                          {labelledObjectCell(
                            typeof row.name === "string" && row.name.trim() ? row.name : "Unknown person",
                          )}
                        </td>
                        <td className="py-2 pr-3">{labelledObjectCell(departmentName(row, departments))}</td>
                        <td className="py-2">{labelledObjectCell(periodLabel(row.period ?? selectedPeriod))}</td>
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
