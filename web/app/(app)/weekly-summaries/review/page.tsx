"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi } from "@/lib/api";
import { canReviewWeeklySummaries, getStoredUser } from "@/lib/auth";
import { formatDateRange, formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

type PeriodSummary = {
  id?: number;
  reference?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  employee_due_at?: string | null;
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

function shortDate(value: unknown): string {
  if (value == null || value === "") return "";
  const formatted = formatDateShort(String(value));
  return formatted === "—" ? "" : formatted;
}

function periodLabel(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return "—";
  const ref = rec.reference != null && rec.reference !== "" ? String(rec.reference) : "";
  const start = rec.start_date != null && rec.start_date !== "" ? String(rec.start_date) : "";
  const end = rec.end_date != null && rec.end_date !== "" ? String(rec.end_date) : "";
  const range = start || end ? formatDateRange(start || null, end || null) : "";
  return [ref, range].filter(Boolean).join(" · ") || "—";
}

function labelledText(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return value == null ? "" : String(value);
  const labelled = rec.name ?? rec.title ?? rec.label ?? rec.reference;
  return labelled == null ? "" : String(labelled);
}

function ownerLabel(row: Record<string, unknown>): unknown {
  if (typeof row.employee_name === "string" && row.employee_name.trim()) return row.employee_name;
  if (row.employee) return row.employee;
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  return "Unknown owner";
}

function personLabel(row: Record<string, unknown>): unknown {
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  if (typeof row.employee_name === "string" && row.employee_name.trim()) return row.employee_name;
  if (row.employee) return row.employee;
  return "Unknown person";
}

function departmentLabel(row: Record<string, unknown>): unknown {
  if (row.department && typeof row.department === "object") return row.department;
  if (typeof row.department_name === "string" && row.department_name.trim()) return row.department_name;
  const employee = asRecord(row.employee);
  if (employee?.department && typeof employee.department === "object") return employee.department;
  if (typeof employee?.department_name === "string" && employee.department_name.trim()) {
    return employee.department_name;
  }
  return "—";
}

function reportId(row: Record<string, unknown>): number | null {
  const id = typeof row.id === "number" ? row.id : Number(row.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function daysLateLabel(row: Record<string, unknown>): string {
  const raw = row.days_late;
  const days = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(days) && days > 0) {
    return days === 1 ? "1 day" : `${days} days`;
  }
  return "—";
}

function httpStatus(error: unknown): number | null {
  if (!error || typeof error !== "object" || !("response" in error)) return null;
  const status = (error as { response?: { status?: number } }).response?.status;
  return typeof status === "number" ? status : null;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

export default function WeeklySummariesReviewPage() {
  const allowed = canReviewWeeklySummaries(getStoredUser());
  const [pendingCount, setPendingCount] = useState(0);
  const [overdueCount, setOverdueCount] = useState(0);
  const [queue, setQueue] = useState<Record<string, unknown>[]>([]);
  const [missing, setMissing] = useState<Record<string, unknown>[]>([]);
  const [period, setPeriod] = useState<PeriodSummary | null>(null);
  const [staffQuery, setStaffQuery] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [forbidden, setForbidden] = useState(!allowed);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    if (!canReviewWeeklySummaries(getStoredUser())) {
      setForbidden(true);
      setBusy(false);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { data } = await weeklyReportsApi.reviewQueue();
      const payload = (data.data ?? {}) as Record<string, unknown>;
      const pendingReports = asRows(payload.team_pending_reports);
      const missingReports = asRows(payload.missing_reports);
      setPendingCount(Number(payload.team_pending_review ?? pendingReports.length ?? 0));
      setOverdueCount(Number(payload.overdue_count ?? 0));
      setQueue(pendingReports);
      setMissing(missingReports);
      setPeriod(asRecord(payload.period) as PeriodSummary | null);
      setForbidden(false);
    } catch (e: unknown) {
      if (httpStatus(e) === 403) {
        setForbidden(true);
        setError(null);
      } else {
        setError(errorMessage(e, "Failed to load the review queue"));
      }
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const departmentNames = useMemo(() => {
    const names = new Set<string>();
    for (const row of [...queue, ...missing]) {
      const name = labelledText(departmentLabel(row)).trim();
      if (name && name !== "—") names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [queue, missing]);

  const staffTerm = staffQuery.trim().toLowerCase();

  const filteredQueue = useMemo(() => {
    return queue.filter((row) => {
      if (departmentName && labelledText(departmentLabel(row)).toLowerCase() !== departmentName.toLowerCase()) {
        return false;
      }
      if (!staffTerm) return true;
      const haystack = [ownerLabel(row), row.reference]
        .map((value) => (typeof value === "string" ? value : labelledText(value)))
        .join(" ")
        .toLowerCase();
      return haystack.includes(staffTerm);
    });
  }, [queue, departmentName, staffTerm]);

  const filteredMissing = useMemo(() => {
    return missing.filter((row) => {
      if (departmentName && labelledText(departmentLabel(row)).toLowerCase() !== departmentName.toLowerCase()) {
        return false;
      }
      if (!staffTerm) return true;
      const haystack = [personLabel(row), ownerLabel(row)]
        .map((value) => (typeof value === "string" ? value : labelledText(value)))
        .join(" ")
        .toLowerCase();
      return haystack.includes(staffTerm);
    });
  }, [missing, departmentName, staffTerm]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Review queue"
        subtitle="Pending and missing weekly summaries for supervisors and the Secretary General. Accept and return happen on the report detail page — this queue never auto-accepts."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Team review" },
            ]}
          />
        }
      />

      {forbidden ? (
        <EmptyState
          icon="lock"
          title="Review queue is for supervisors and the Secretary General"
          description="Staff who do not review weekly summaries cannot open this queue. Supervisors see their team or department; the Secretary General sees the full tenant queue."
        />
      ) : null}

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

      {!busy && !error && !forbidden ? (
        <>
          <FormSection
            title="Review metrics"
            description="Honest counts from the current-period review queue. This page does not invent sign-off or UAT status."
            icon="monitoring"
          >
            <LabelledRecord
              value={{
                pending_review: pendingCount,
                missing_reports: missing.length,
                overdue: overdueCount,
                period: periodLabel(period),
              }}
            />
          </FormSection>

          <FormSection
            title="Filter the queue"
            description="Search by staff name and department name. Filters never use numeric IDs."
            icon="filter_alt"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Staff name" htmlFor="weekly-review-staff">
                <input
                  id="weekly-review-staff"
                  className="form-input"
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder="Search by staff name"
                />
              </FormField>
              <FormField label="Department" htmlFor="weekly-review-department">
                <select
                  id="weekly-review-department"
                  className="form-input"
                  value={departmentName}
                  onChange={(event) => setDepartmentName(event.target.value)}
                >
                  <option value="">All departments</option>
                  {departmentNames.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Pending review queue"
            description="Open a report to accept or return it. Accept and return stay on the detail page so there is one authority path."
            icon="rate_review"
          >
            {filteredQueue.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="No reports pending review"
                description="Submitted summaries in your review scope will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Pending weekly summaries</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Reference</th>
                      <th className="py-2 pr-3 font-medium">Staff</th>
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Submitted</th>
                      <th className="py-2 font-medium">Days late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((row, idx) => {
                      const id = reportId(row);
                      return (
                        <tr key={id ?? `pending-${idx}`} className="border-b border-neutral-50">
                          <td className="py-2 pr-3">
                            {id ? (
                              <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary hover:underline">
                                {String(row.reference ?? `Report ${id}`)}
                              </Link>
                            ) : (
                              labelledObjectCell(row.reference ?? "—")
                            )}
                          </td>
                          <td className="py-2 pr-3">{labelledObjectCell(ownerLabel(row))}</td>
                          <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(row))}</td>
                          <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                          <td className="py-2 pr-3 capitalize">{labelledObjectCell(row.status ?? "—")}</td>
                          <td className="py-2 pr-3">{shortDate(row.submitted_at) || "—"}</td>
                          <td className="py-2">{daysLateLabel(row)}</td>
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
            description="People in your review scope who have not submitted for this period."
            icon="person_off"
          >
            {filteredMissing.length === 0 ? (
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
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 font-medium">Days late</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMissing.map((row, idx) => (
                      <tr key={row.id != null && row.id !== "" ? String(row.id) : `missing-${idx}`} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{labelledObjectCell(personLabel(row))}</td>
                        <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(row))}</td>
                        <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                        <td className="py-2">{daysLateLabel(row)}</td>
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
