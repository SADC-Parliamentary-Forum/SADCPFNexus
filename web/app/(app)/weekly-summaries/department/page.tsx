"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adminApi, reportsApi, weeklyReportsApi, type Department, type WeeklyOpsReport } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useToast } from "@/components/ui/Toast";
import { formatDateShort } from "@/lib/utils";

type PeriodRow = {
  id: number;
  reference?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
  employee_due_at?: string | null;
};

type StaffRow = {
  id: number;
  name?: string | null;
  report_id?: number | null;
  reference?: string | null;
  status?: string | null;
  submitted_at?: string | null;
  employee_due_at?: string | null;
};

type RollupCounts = { submitted: number; missing: number; late: number };

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

function unwrapRows<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
  }
  return [];
}

function errorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "response" in error) {
    const data = (error as { response?: { data?: { message?: string } } }).response?.data;
    if (data?.message) return data.message;
  }
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}

function departmentLabel(dept: Pick<Department, "name" | "code">): string {
  const name = dept.name?.trim() || "Unnamed department";
  const code = dept.code?.trim();
  return code ? `${name} (${code})` : name;
}

function periodRangeLabel(period: Pick<PeriodRow, "start_date" | "end_date">): string {
  if (period.start_date && period.end_date) {
    const start = formatDateShort(period.start_date);
    const end = formatDateShort(period.end_date);
    if (start === "—" && end === "—") return "";
    if (start === end || end === "—") return start;
    if (start === "—") return end;
    const startParts = start.split(" ");
    const endParts = end.split(" ");
    if (
      startParts.length === 3 &&
      endParts.length === 3 &&
      startParts[1] === endParts[1] &&
      startParts[2] === endParts[2]
    ) {
      return `${startParts[0]}–${endParts[0]} ${endParts[1]} ${endParts[2]}`;
    }
    if (startParts[2] === endParts[2]) {
      return `${startParts[0]} ${startParts[1]} – ${endParts[0]} ${endParts[1]} ${endParts[2]}`;
    }
    return `${start} – ${end}`;
  }
  const single = formatDateShort(period.start_date ?? period.end_date);
  return single === "—" ? "" : single;
}

function periodLabel(period: PeriodRow): string {
  const reference = period.reference?.trim();
  const range = periodRangeLabel(period);
  if (range) return reference ? `${reference} · ${range}` : range;
  return reference || "Current period";
}

function humanStatus(status?: string | null): string {
  if (!status) return "—";
  return STATUS_LABELS[status] ?? status.replace(/_/g, " ");
}

function staffName(row: StaffRow): string {
  return row.name?.trim() || "Unknown person";
}

function staffReportId(row: StaffRow): number | null {
  const id = Number(row.report_id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function matchesStaff(row: StaffRow, query: string): boolean {
  if (!query) return true;
  return [row.name, row.reference, row.status]
    .filter((value): value is string => typeof value === "string" && value.trim() !== "")
    .join(" ")
    .toLowerCase()
    .includes(query);
}

function asStaffRows(value: unknown): StaffRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is StaffRow => Boolean(row && typeof row === "object" && "id" in row));
}

function DepartmentPicker({
  departments,
  selected,
  onSelect,
  disabled,
}: {
  departments: Department[];
  selected: Department | null;
  onSelect: (dept: Department) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "department-picker-list";
  const inputId = "department-picker";

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return departments;
    return departments.filter((dept) => {
      const name = (dept.name ?? "").toLowerCase();
      const code = (dept.code ?? "").toLowerCase();
      return name.includes(term) || code.includes(term);
    });
  }, [departments, query]);

  useEffect(() => {
    if (!open && selected) setQuery(departmentLabel(selected));
  }, [open, selected]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        if (selected) setQuery(departmentLabel(selected));
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selected]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const choose = (dept: Department) => {
    onSelect(dept);
    setQuery(departmentLabel(dept));
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <input
        id={inputId}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && filtered[activeIndex] ? `department-option-${filtered[activeIndex].id}` : undefined}
        className="form-input"
        placeholder="Search department by name or code"
        value={query}
        disabled={disabled}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          if (selected && query === departmentLabel(selected)) setQuery("");
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
            if (selected) setQuery(departmentLabel(selected));
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
            filtered.map((dept, index) => (
              <li key={dept.id} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`department-option-${dept.id}`}
                  aria-selected={selected?.id === dept.id}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                    index === activeIndex ? "bg-primary/5 text-neutral-900" : "text-neutral-700 hover:bg-neutral-50"
                  }`}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    choose(dept);
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="font-medium">{dept.name}</span>
                  {dept.code ? <span className="text-xs text-neutral-500">{dept.code}</span> : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}

function StaffTable({
  rows,
  emptyTitle,
  emptyDescription,
  dateHeader,
  dateValue,
}: {
  rows: StaffRow[];
  emptyTitle: string;
  emptyDescription: string;
  dateHeader: string;
  dateValue: (row: StaffRow) => string | null | undefined;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState icon="person_off" title={emptyTitle} description={emptyDescription} />
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-neutral-100 text-neutral-500">
            <th className="py-2 pr-3 font-medium">Name</th>
            <th className="py-2 pr-3 font-medium">{dateHeader}</th>
            <th className="py-2 pr-3 font-medium">Status</th>
            <th className="py-2 font-medium">Report</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const reportId = staffReportId(row);
            return (
              <tr key={row.id} className="border-b border-neutral-50">
                <td className="py-2 pr-3">{staffName(row)}</td>
                <td className="py-2 pr-3">{formatDateShort(dateValue(row))}</td>
                <td className="py-2 pr-3">{humanStatus(row.status)}</td>
                <td className="py-2">
                  {reportId ? (
                    <Link href={`/weekly-summaries/${reportId}`} className="font-medium text-primary hover:underline">
                      {row.reference?.trim() || "Open"}
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
  );
}

export default function WeeklyDepartmentPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [periodId, setPeriodId] = useState<number | "">("");
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [submittedStaff, setSubmittedStaff] = useState<StaffRow[]>([]);
  const [missingStaff, setMissingStaff] = useState<StaffRow[]>([]);
  const [lateStaff, setLateStaff] = useState<StaffRow[]>([]);
  const [counts, setCounts] = useState<RollupCounts>({ submitted: 0, missing: 0, late: 0 });
  const [staffQuery, setStaffQuery] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setError(null);
    Promise.all([adminApi.listDepartments().catch(() => reportsApi.departments()), weeklyReportsApi.periods()])
      .then(([deptRes, periodRes]) => {
        if (cancelled) return;
        const deptRows = unwrapRows<Department>(deptRes.data);
        const periodRows = unwrapRows<PeriodRow>(periodRes.data);
        setDepartments(deptRows);
        setPeriods(periodRows);
        if (periodRows[0]?.id) setPeriodId(periodRows[0].id);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(errorMessage(err, "Failed to load departments"));
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadRollup = useCallback(async (dept: Department, selectedPeriodId: number) => {
    setRollupLoading(true);
    setError(null);
    try {
      const { data: reportRes } = await weeklyReportsApi.department(selectedPeriodId, dept.id);
      const payload = reportRes.data;
      setReport(payload);
      const submitted = asStaffRows(payload.submitted_staff);
      const missing = asStaffRows(payload.missing_staff);
      const late = asStaffRows(payload.late_staff);
      setSubmittedStaff(submitted);
      setMissingStaff(missing);
      setLateStaff(late);
      setCounts({
        submitted: Number(payload.counts?.submitted ?? submitted.length),
        missing: Number(payload.counts?.missing ?? missing.length),
        late: Number(payload.counts?.late ?? late.length),
      });
      if (payload.department?.name && !dept.name) {
        setSelectedDept({ ...dept, name: payload.department.name, code: payload.department.code ?? dept.code });
      }
    } catch (err: unknown) {
      setReport(null);
      setSubmittedStaff([]);
      setMissingStaff([]);
      setLateStaff([]);
      setCounts({ submitted: 0, missing: 0, late: 0 });
      setError(errorMessage(err, "Failed to load department summary"));
    } finally {
      setRollupLoading(false);
    }
  }, []);

  const handleSelectDepartment = (dept: Department) => {
    setSelectedDept(dept);
    if (periodId) void loadRollup(dept, Number(periodId));
  };

  const handlePeriodChange = (nextPeriodId: number | "") => {
    setPeriodId(nextPeriodId);
    if (selectedDept && nextPeriodId) void loadRollup(selectedDept, Number(nextPeriodId));
  };

  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;
  const query = staffQuery.trim().toLowerCase();
  const submittedRows = submittedStaff.filter((row) => matchesStaff(row, query));
  const missingRows = missingStaff.filter((row) => matchesStaff(row, query));
  const lateRows = lateStaff.filter((row) => matchesStaff(row, query));
  const rollupDepartment = report?.department?.name
    ? departmentLabel({ name: report.department.name, code: report.department.code ?? selectedDept?.code ?? "" })
    : selectedDept
      ? departmentLabel(selectedDept)
      : "—";
  const rollupPeriod = report?.period ? periodLabel(report.period) : selectedPeriod ? periodLabel(selectedPeriod) : "—";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <ModulePageHeader
        title="Department Summary"
        subtitle="Consolidates selected employee items — does not rewrite original reports. AI draft never auto-submits."
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "Weekly Summaries", href: "/weekly-summaries" },
              { label: "Department" },
            ]}
          />
        }
        actions={
          report ? (
            <Link href={`/weekly-summaries/${report.id}`} className="btn-secondary text-sm">
              Open detail
            </Link>
          ) : null
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error.startsWith("Failed to load") ? error : `Failed to load department summary: ${error}`}
        </div>
      ) : null}

      <FormSection
        title="Choose department"
        description="Search by department name or code. Numeric IDs stay internal."
        icon="apartment"
      >
        {catalogLoading ? (
          <div className="space-y-3" aria-live="polite">
            <p className="text-sm text-neutral-500">Loading departments…</p>
            {[0, 1].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <FormField label="Department" htmlFor="department-picker" hint="Type a name to filter, then choose from the list.">
              <DepartmentPicker
                departments={departments}
                selected={selectedDept}
                onSelect={handleSelectDepartment}
                disabled={rollupLoading}
              />
            </FormField>
            <FormField label="Reporting period" htmlFor="department-period" hint="Shown as a short date range, not a numeric identifier.">
              <select
                id="department-period"
                className="form-input"
                value={periodId}
                disabled={rollupLoading || periods.length === 0}
                onChange={(event) => handlePeriodChange(event.target.value ? Number(event.target.value) : "")}
              >
                {periods.length === 0 ? <option value="">No periods available</option> : null}
                {periods.map((period) => (
                  <option key={period.id} value={period.id}>
                    {periodLabel(period)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
        )}
      </FormSection>

      {rollupLoading ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">Loading department summary…</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {!catalogLoading && departments.length === 0 && !error ? (
        <div className="card">
          <EmptyState
            icon="apartment"
            title="No departments"
            description="No organisational departments are available to summarise."
          />
        </div>
      ) : null}

      {!rollupLoading && !selectedDept && departments.length > 0 ? (
        <div className="card">
          <EmptyState
            icon="edit_calendar"
            title="Select a department"
            description="Choose a department by name to load its weekly rollup, missing staff, and submitted reports."
          />
        </div>
      ) : null}

      {!rollupLoading && selectedDept && !periodId && !error ? (
        <div className="card">
          <EmptyState
            icon="event_busy"
            title="No reporting period"
            description="A labelled reporting period is required before the department rollup can load."
          />
        </div>
      ) : null}

      {!rollupLoading && selectedDept && Boolean(periodId) && !report && !error ? (
        <div className="card">
          <EmptyState
            icon="edit_calendar"
            title="No department summary"
            description="A weekly rollup for this department will appear here when available."
          />
        </div>
      ) : null}

      {report && !rollupLoading ? (
        <>
          <FormSection
            title="Department rollup"
            description={`${rollupDepartment} · ${rollupPeriod}`}
            icon="summarize"
            actions={
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={publishing || report.status === "published" || report.status === "closed"}
                onClick={async () => {
                  if (publishing) return;
                  setPublishing(true);
                  try {
                    const { data } = await weeklyReportsApi.publish(report.id);
                    setReport({ ...report, ...data.data });
                  } catch (err: unknown) {
                    toast("error", errorMessage(err, "Failed to publish report"));
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                {publishing ? "Publishing..." : report.status === "published" ? "Published" : "Publish"}
              </button>
            }
          >
            <LabelledRecord
              value={{
                department: rollupDepartment,
                period: rollupPeriod,
                status: humanStatus(report.status),
                reference: report.reference,
                version: `v${report.version}`,
                items: report.items?.length ?? 0,
                blockers: report.blockers?.length ?? 0,
              }}
            />
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Submitted</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{counts.submitted}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Missing</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{counts.missing}</p>
              </div>
              <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Late</p>
                <p className="mt-1 text-2xl font-semibold text-neutral-900">{counts.late}</p>
              </div>
            </div>
          </FormSection>

          <FormSection title="Find staff" description="Filter the submitted, missing, and late tables by staff name." icon="search">
            <FormField label="Staff name" htmlFor="department-staff-search" hint="Filter is local to this rollup. It does not submit or publish anything.">
              <input
                id="department-staff-search"
                className="form-input max-w-xl"
                placeholder="Search staff by name"
                value={staffQuery}
                onChange={(event) => setStaffQuery(event.target.value)}
              />
            </FormField>
          </FormSection>

          <FormSection title="Submitted staff" description="People in this department who have submitted for the selected period." icon="assignment">
            <StaffTable
              rows={submittedRows}
              emptyTitle="No submitted staff"
              emptyDescription="Submitted weekly summaries for this department will appear here."
              dateHeader="Submitted"
              dateValue={(row) => row.submitted_at}
            />
          </FormSection>

          <FormSection title="Missing staff" description="Staff in this department who have not submitted for the selected period." icon="person_off">
            <StaffTable
              rows={missingRows}
              emptyTitle="No missing staff"
              emptyDescription="No missing staff in this department for the selected period."
              dateHeader="Due"
              dateValue={(row) => row.employee_due_at}
            />
          </FormSection>

          <FormSection title="Late staff" description="Overdue missing reports and submissions after the employee due date." icon="schedule">
            <StaffTable
              rows={lateRows}
              emptyTitle="No late staff"
              emptyDescription="Nobody in this department is late for the selected period."
              dateHeader="Due"
              dateValue={(row) => row.employee_due_at}
            />
          </FormSection>
        </>
      ) : null}
    </div>
  );
}
