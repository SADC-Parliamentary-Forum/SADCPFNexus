"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";

type FocusFilter = "all" | "late" | "missing" | "unaccepted";
type TableColumn = "reference" | "person" | "period" | "department" | "status" | "days";

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  in_progress: "In progress",
  ready: "Ready",
  not_started: "Not started",
  submitted: "Submitted",
  pending_review: "Pending review",
  resubmitted: "Resubmitted",
  returned: "Returned",
  accepted: "Accepted",
  published: "Published",
  exempted: "Exempted",
  reopened: "Reopened",
  missing: "Missing",
  late: "Late",
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
  const start = shortDate(rec.start_date);
  const end = shortDate(rec.end_date);
  const range = start && end ? `${start} – ${end}` : start || end;
  return [ref, range].filter(Boolean).join(" · ") || "—";
}

function humanStatus(status: unknown): string {
  if (status == null || status === "") return "—";
  const raw = String(status);
  if (STATUS_LABELS[raw]) return STATUS_LABELS[raw];
  return raw.replace(/_/g, " ");
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

function reportId(row: Record<string, unknown>): number | null {
  const candidate = row.report_id ?? row.weekly_report_id ?? row.id;
  const id = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function reportIdForListedReport(row: Record<string, unknown>): number | null {
  const nested = asRecord(row.report);
  if (nested) {
    const nestedId = reportId(nested);
    if (nestedId) return nestedId;
  }
  if (row.report_id != null || row.weekly_report_id != null) return reportId(row);
  if (typeof row.reference === "string" && row.reference.trim()) return reportId(row);
  return null;
}

function isPastDue(period: Record<string, unknown> | null, report?: Record<string, unknown> | null): boolean {
  const due = report?.employee_due_at ?? period?.employee_due_at;
  if (due == null || due === "") return false;
  const dueAt = new Date(String(due));
  return Number.isFinite(dueAt.getTime()) && dueAt.getTime() < Date.now();
}

function isOpenStatus(status: unknown): boolean {
  return ["draft", "in_progress", "ready", "returned", "reopened", "not_started", "missing"].includes(String(status ?? ""));
}

function isUnacceptedStatus(status: unknown): boolean {
  return ["submitted", "pending_review", "resubmitted"].includes(String(status ?? ""));
}

function labelledText(value: unknown): string {
  const rec = asRecord(value);
  if (!rec) return value == null ? "" : String(value);
  const labelled = rec.name ?? rec.title ?? rec.label ?? rec.reference;
  return labelled == null ? "" : String(labelled);
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

function daysLate(due: unknown): string {
  if (due == null || due === "") return "—";
  const dueAt = new Date(String(due));
  if (!Number.isFinite(dueAt.getTime())) return "—";
  const days = Math.floor((Date.now() - dueAt.getTime()) / 86_400_000);
  if (days <= 0) return "—";
  return days === 1 ? "1 day" : `${days} days`;
}

function dueAt(row: Record<string, unknown>, periodFallback: Record<string, unknown> | null): unknown {
  const nestedPeriod = asRecord(row.period);
  return row.employee_due_at ?? nestedPeriod?.employee_due_at ?? periodFallback?.employee_due_at;
}

function matchesPerson(row: Record<string, unknown>, query: string): boolean {
  if (!query) return true;
  const haystack = [personLabel(row), ownerLabel(row), row.reference]
    .map((value) => (typeof value === "string" ? value : labelledText(value)))
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

function matchesDepartment(row: Record<string, unknown>, departmentName: string): boolean {
  if (!departmentName) return true;
  return labelledText(departmentLabel(row)).toLowerCase() === departmentName.toLowerCase();
}

function DepartmentNamePicker({
  names,
  selected,
  onSelect,
}: {
  names: string[];
  selected: string;
  onSelect: (name: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "compliance-department-list";
  const options = useMemo(() => ["All departments", ...names], [names]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((name) => name.toLowerCase().includes(term));
  }, [options, query]);

  useEffect(() => {
    if (!open) setQuery(selected || "");
  }, [open, selected]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery(selected || "");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selected]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const choose = (name: string) => {
    onSelect(name === "All departments" ? "" : name);
    setQuery(name === "All departments" ? "" : name);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id="compliance-department"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filtered[activeIndex] ? `compliance-dept-option-${activeIndex}` : undefined}
        className="form-input"
        placeholder="Search department by name"
        value={open ? query : selected || query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActiveIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter" && open && filtered[activeIndex]) {
            event.preventDefault();
            choose(filtered[activeIndex]);
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
            setQuery(selected || "");
          }
        }}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Departments"
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">No departments match that name.</li>
          ) : (
            filtered.map((name, index) => (
              <li key={name} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`compliance-dept-option-${index}`}
                  aria-selected={(selected || "All departments") === name}
                  className={`flex w-full items-center px-3 py-2 text-left text-sm ${
                    index === activeIndex ? "bg-primary/5 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(name);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  {name}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

export default function WeeklyCompliancePage() {
  const [period, setPeriod] = useState<Record<string, unknown> | null>(null);
  const [myReport, setMyReport] = useState<Record<string, unknown> | null>(null);
  const [missing, setMissing] = useState<Record<string, unknown>[]>([]);
  const [unaccepted, setUnaccepted] = useState<Record<string, unknown>[]>([]);
  const [compliance, setCompliance] = useState<Record<string, unknown>>({});
  const [trends, setTrends] = useState<Record<string, unknown> | null>(null);
  const [focus, setFocus] = useState<FocusFilter>("all");
  const [personQuery, setPersonQuery] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = async () => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const [{ data }, trendResult] = await Promise.all([
        weeklyReportsApi.dashboard(),
        weeklyReportsApi.trends().catch(() => null),
      ]);
      const payload = (data.data ?? {}) as Record<string, unknown>;
      const pendingReports = asRows(payload.team_pending_reports);
      const mine = asRecord(payload.my_report);
      setPeriod(asRecord(payload.period));
      setMyReport(mine);
      setMissing(asRows(payload.missing_reports));
      setUnaccepted(pendingReports);
      setCompliance(asRecord(payload.compliance) ?? {});
      setTrends(trendResult ? asRecord(trendResult.data.data) : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load weekly report compliance.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  const query = personQuery.trim().toLowerCase();
  const pastDue = isPastDue(period, myReport);
  const myReportLate = Boolean(myReport && isOpenStatus(myReport.status) && isPastDue(period, myReport));
  const myReportUnaccepted = Boolean(myReport && isUnacceptedStatus(myReport.status));
  const myReportId = myReport ? reportId(myReport) : null;
  const unacceptedCount =
    unaccepted.length +
    (myReportUnaccepted && myReportId && !unaccepted.some((row) => reportId(row) === myReportId) ? 1 : 0);
  const lateCount = (pastDue ? missing.length : 0) + (myReportLate ? 1 : 0);
  const countCards = [
    { label: "Late", value: lateCount },
    { label: "Missing", value: missing.length },
    { label: "Unaccepted", value: unacceptedCount },
  ];

  const departmentNames = useMemo(() => {
    const names = new Set<string>();
    const rows = [...missing, ...unaccepted];
    if (myReport) rows.push(myReport);
    for (const row of rows) {
      const name = labelledText(departmentLabel(row)).trim();
      if (name && name !== "—") names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [missing, myReport, unaccepted]);

  const lateRows = useMemo(() => {
    const rows: Record<string, unknown>[] = [];
    if (myReportLate && myReport) {
      rows.push({
        ...myReport,
        finding: "Late",
        employee_name: "Your report",
      });
    }
    if (pastDue) {
      for (const row of missing) {
        rows.push({ ...row, finding: "Late — not submitted", status: "late" });
      }
    }
    return rows.filter((row) => matchesPerson(row, query) && matchesDepartment(row, departmentName));
  }, [departmentName, missing, myReport, myReportLate, pastDue, query]);

  const missingRows = useMemo(
    () => missing.filter((row) => matchesPerson(row, query) && matchesDepartment(row, departmentName)),
    [departmentName, missing, query],
  );

  const unacceptedRows = useMemo(() => {
    const rows = [...unaccepted];
    const alreadyListed = new Set(rows.map((row) => reportId(row)).filter((id): id is number => id != null));
    if (myReportUnaccepted && myReport) {
      const id = reportId(myReport);
      if (id && !alreadyListed.has(id)) {
        rows.unshift({ ...myReport, employee_name: "Your report" });
      }
    }
    return rows.filter((row) => matchesPerson(row, query) && matchesDepartment(row, departmentName));
  }, [departmentName, myReport, myReportUnaccepted, query, unaccepted]);

  const trendSummary = asRecord(trends?.summary);
  const showLate = focus === "all" || focus === "late";
  const showMissing = focus === "all" || focus === "missing";
  const showUnaccepted = focus === "all" || focus === "unaccepted";
  const dueLabel = shortDate(period?.employee_due_at);
  const periodDescription = [
    periodLabel(period),
    dueLabel ? `Due ${dueLabel}` : "",
    pastDue ? "Employee due date has passed" : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const exportMissingCsv = () => {
    const lines = [
      "Person,Department,Period,Finding",
      ...missingRows.map((row) => {
        const person = String(labelledText(personLabel(row)) || "Unknown person").replaceAll('"', '""');
        const department = String(labelledText(departmentLabel(row)) || "—").replaceAll('"', '""');
        const periodText = periodLabel(row.period ?? period).replaceAll('"', '""');
        const finding = pastDue ? "Late — not submitted" : "Not submitted";
        return `"${person}","${department}","${periodText}","${finding}"`;
      }),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-compliance-missing-${String(period?.reference ?? "current")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice("Missing-report CSV exported. Scheduled digests still go out Mondays at 08:40. This does not close findings.");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Weekly report compliance"
        subtitle="Current-period submitted, late, missing, and unaccepted reports. Findings are not auto-closed — open a report to review it."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Compliance" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {myReportId ? (
              <Link href={`/weekly-summaries/${myReportId}`} className="btn-secondary text-sm">
                Open your report
              </Link>
            ) : null}
            <button type="button" className="btn-secondary text-sm" onClick={() => void reload()} disabled={busy}>
              Refresh
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error.startsWith("Failed to load") ? error : `Failed to load weekly report compliance: ${error}`}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {notice}
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
            title="Filters"
            description="The current tenant period loads automatically. Filter by finding type, person, or department name — numeric IDs are not required."
            icon="filter_alt"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="Show" htmlFor="compliance-focus">
                <select
                  id="compliance-focus"
                  className="form-input"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value as FocusFilter)}
                >
                  <option value="all">All findings</option>
                  <option value="late">Late</option>
                  <option value="missing">Missing</option>
                  <option value="unaccepted">Unaccepted</option>
                </select>
              </FormField>
              <FormField label="Person" htmlFor="compliance-person" hint="Filter listed people and reports by name.">
                <input
                  id="compliance-person"
                  className="form-input"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder="Search by person or reference"
                />
              </FormField>
              <FormField label="Department" htmlFor="compliance-department" hint="Filter by department name.">
                <DepartmentNamePicker names={departmentNames} selected={departmentName} onSelect={setDepartmentName} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="Compliance snapshot" description={periodDescription} icon="fact_check">
            <div className="grid gap-3 sm:grid-cols-3">
              {countCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{card.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{card.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <LabelledRecord
                value={{
                  period: periodLabel(period),
                  submitted: Number(compliance.submitted ?? 0),
                  exempted: Number(compliance.exempted ?? 0),
                }}
              />
            </div>
            {trendSummary ? (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Last 12 weeks</h3>
                <LabelledRecord
                  value={{
                    reports: trendSummary.total_reports ?? 0,
                    completed: trendSummary.completed ?? 0,
                    "completion rate": `${trendSummary.completion_rate ?? 0}%`,
                    "missing or late": trendSummary.missing_or_late ?? 0,
                  }}
                />
              </div>
            ) : null}
          </FormSection>

          {myReport ? (
            <FormSection
              title="Your report"
              description="Open the detail page to continue work. This compliance view never submits or accepts a report."
              icon="edit_calendar"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Your current weekly summary</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Reference</th>
                      <th className="py-2 pr-3 font-medium">Period</th>
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-50">
                      <td className="py-2 pr-3">
                        {reportId(myReport) ? (
                          <Link
                            href={`/weekly-summaries/${reportId(myReport)}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {String(myReport.reference ?? "Open report")}
                          </Link>
                        ) : (
                          labelledObjectCell(myReport.reference ?? "—")
                        )}
                      </td>
                      <td className="py-2 pr-3">{labelledObjectCell(periodLabel(myReport.period ?? period))}</td>
                      <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(myReport))}</td>
                      <td className="py-2">{labelledObjectCell(humanStatus(myReport.status))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </FormSection>
          ) : null}

          {showLate ? (
            <FormSection
              title="Late reports"
              description="Draft or missing reports after the employee due date. Opening a report does not close the finding."
              icon="schedule"
              actions={
                missingRows.length > 0 && pastDue ? (
                  <button type="button" className="btn-secondary text-sm" onClick={exportMissingCsv}>
                    Export missing CSV
                  </button>
                ) : null
              }
            >
              {lateRows.length === 0 ? (
                <EmptyState
                  icon="check_circle"
                  title="No late reports"
                  description={
                    pastDue
                      ? "Everyone in scope has submitted or is exempt for this period."
                      : "The employee due date has not passed yet."
                  }
                />
              ) : (
                <ComplianceTable
                  caption="Late weekly summaries"
                  rows={lateRows}
                  columns={["person", "department", "period", "days", "status"]}
                  periodFallback={period}
                  linkReports
                />
              )}
            </FormSection>
          ) : null}

          {showMissing ? (
            <FormSection
              title="Missing reports"
              description="People in scope who have not submitted for this period. Names are listed until a report exists to open."
              icon="person_off"
              actions={
                missingRows.length > 0 ? (
                  <button type="button" className="btn-secondary text-sm" onClick={exportMissingCsv}>
                    Export missing CSV
                  </button>
                ) : null
              }
            >
              {missingRows.length === 0 ? (
                <EmptyState
                  icon="check_circle"
                  title="No missing reports"
                  description="None listed for your scope in the current period."
                />
              ) : (
                <ComplianceTable
                  caption="People missing weekly summaries"
                  rows={missingRows}
                  columns={["person", "department", "period", "days", "status"]}
                  periodFallback={period}
                  personRows
                />
              )}
            </FormSection>
          ) : null}

          {showUnaccepted ? (
            <FormSection
              title="Unaccepted reports"
              description="Submitted summaries still waiting for supervisor review. Accept and return stay on the report detail page."
              icon="pending_actions"
            >
              {unacceptedRows.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="No unaccepted reports"
                  description="Submitted reports awaiting review will appear here. Nothing is auto-accepted."
                />
              ) : (
                <ComplianceTable
                  caption="Unaccepted weekly summaries"
                  rows={unacceptedRows}
                  columns={["reference", "person", "department", "period", "status"]}
                  periodFallback={period}
                  linkReports
                />
              )}
            </FormSection>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function ComplianceTable({
  caption,
  rows,
  columns,
  periodFallback = null,
  linkReports = false,
  personRows = false,
}: {
  caption: string;
  rows: Record<string, unknown>[];
  columns: TableColumn[];
  periodFallback?: Record<string, unknown> | null;
  linkReports?: boolean;
  personRows?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-neutral-100 text-neutral-500">
            {columns.includes("reference") ? <th className="py-2 pr-3 font-medium">Reference</th> : null}
            {columns.includes("person") ? <th className="py-2 pr-3 font-medium">Person</th> : null}
            {columns.includes("department") ? <th className="py-2 pr-3 font-medium">Department</th> : null}
            {columns.includes("period") ? <th className="py-2 pr-3 font-medium">Period</th> : null}
            {columns.includes("days") ? <th className="py-2 pr-3 font-medium">Days late</th> : null}
            {columns.includes("status") ? <th className="py-2 font-medium">Status</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const id = reportIdForListedReport(row);
            const status = row.finding ?? row.status ?? (personRows ? "missing" : "—");
            return (
              <tr key={id ?? `${caption}-${idx}`} className="border-b border-neutral-50">
                {columns.includes("reference") ? (
                  <td className="py-2 pr-3">
                    {linkReports && id ? (
                      <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary hover:underline">
                        {String(row.reference ?? "Open report")}
                      </Link>
                    ) : (
                      labelledObjectCell(row.reference ?? "No report yet")
                    )}
                  </td>
                ) : null}
                {columns.includes("person") ? (
                  <td className="py-2 pr-3">
                    {linkReports && id ? (
                      <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary hover:underline">
                        {labelledObjectCell(personRows ? personLabel(row) : ownerLabel(row))}
                      </Link>
                    ) : (
                      labelledObjectCell(personRows ? personLabel(row) : ownerLabel(row))
                    )}
                  </td>
                ) : null}
                {columns.includes("department") ? (
                  <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(row))}</td>
                ) : null}
                {columns.includes("period") ? (
                  <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? periodFallback))}</td>
                ) : null}
                {columns.includes("days") ? (
                  <td className="py-2 pr-3">{labelledObjectCell(daysLate(dueAt(row, periodFallback)))}</td>
                ) : null}
                {columns.includes("status") ? (
                  <td className="py-2">{labelledObjectCell(humanStatus(status))}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
