"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { adminApi, weeklyReportsApi, type Department, type WeeklyOpsReport } from "@/lib/api";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormSection, FormField } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord } from "@/components/ui/LabelledRecord";
import { useToast } from "@/components/ui/Toast";

type PeriodRow = {
  id: number;
  reference?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  status?: string | null;
};

type MissingStaff = {
  id: number;
  name?: string | null;
  department_id?: number | null;
};

type SubmittedRow = {
  id: number;
  label: string;
  status?: string;
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

function departmentLabel(dept: Department): string {
  const name = dept.name?.trim() || "Unnamed department";
  const code = dept.code?.trim();
  return code ? `${name} (${code})` : name;
}

function periodLabel(period: PeriodRow): string {
  const reference = period.reference?.trim();
  if (period.start_date && period.end_date) {
    const span = `${period.start_date} → ${period.end_date}`;
    return reference ? `${reference} · ${span}` : span;
  }
  return reference || "Current period";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function submittedReports(report: WeeklyOpsReport): SubmittedRow[] {
  const rows = new Map<number, SubmittedRow>();
  rows.set(report.id, { id: report.id, label: report.reference, status: report.status });

  for (const item of report.items ?? []) {
    const rec = asRecord(item);
    if (!rec) continue;
    const structured = asRecord(rec.structured);
    const sourceId = Number(structured?.source_report_id ?? rec.source_report_id);
    if (!Number.isFinite(sourceId) || sourceId <= 0) continue;
    const label = String(rec.source_reference_snapshot ?? rec.title ?? `Report ${sourceId}`);
    const status = rec.source_status_snapshot != null ? String(rec.source_status_snapshot) : undefined;
    if (!rows.has(sourceId)) rows.set(sourceId, { id: sourceId, label, status });
  }

  const links = (report as WeeklyOpsReport & { consolidation_links?: unknown[] }).consolidation_links;
  if (Array.isArray(links)) {
    for (const link of links) {
      const rec = asRecord(link);
      if (!rec) continue;
      const sourceId = Number(rec.source_report_id);
      if (!Number.isFinite(sourceId) || sourceId <= 0) continue;
      const label = String(rec.source_reference ?? rec.source_reference_snapshot ?? `Report ${sourceId}`);
      if (!rows.has(sourceId)) rows.set(sourceId, { id: sourceId, label });
    }
  }

  return Array.from(rows.values());
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

export default function WeeklyDepartmentPage() {
  const { toast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [periods, setPeriods] = useState<PeriodRow[]>([]);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);
  const [periodId, setPeriodId] = useState<number | "">("");
  const [report, setReport] = useState<WeeklyOpsReport | null>(null);
  const [missingStaff, setMissingStaff] = useState<MissingStaff[]>([]);
  const [counts, setCounts] = useState<{ submitted: number; exempted: number } | null>(null);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [rollupLoading, setRollupLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    setError(null);
    Promise.all([adminApi.listDepartments(), weeklyReportsApi.periods()])
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
      const [{ data: reportRes }, dashRes] = await Promise.all([
        weeklyReportsApi.department(selectedPeriodId, dept.id),
        weeklyReportsApi.dashboard().catch(() => null),
      ]);
      setReport(reportRes.data);
      const dash = dashRes?.data.data as Record<string, unknown> | undefined;
      const missing = unwrapRows<MissingStaff>(dash?.missing_reports ?? []);
      setMissingStaff(missing.filter((row) => row.department_id == null || row.department_id === dept.id));
      const compliance = asRecord(dash?.compliance);
      setCounts({
        submitted: Number(compliance?.submitted ?? 0),
        exempted: Number(compliance?.exempted ?? 0),
      });
    } catch (err: unknown) {
      setReport(null);
      setMissingStaff([]);
      setCounts(null);
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

  const submitted = report ? submittedReports(report) : [];
  const selectedPeriod = periods.find((period) => period.id === periodId) ?? null;

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
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
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
            <FormField label="Reporting period" htmlFor="department-period">
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
            description={
              selectedDept
                ? `${departmentLabel(selectedDept)}${selectedPeriod ? ` · ${periodLabel(selectedPeriod)}` : ""}`
                : undefined
            }
            icon="summarize"
            actions={
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={publishing}
                onClick={async () => {
                  if (publishing) return;
                  setPublishing(true);
                  try {
                    const { data } = await weeklyReportsApi.publish(report.id);
                    setReport(data.data);
                  } catch (err: unknown) {
                    toast("error", errorMessage(err, "Failed to publish report"));
                  } finally {
                    setPublishing(false);
                  }
                }}
              >
                {publishing ? "Publishing..." : "Publish"}
              </button>
            }
          >
            <LabelledRecord
              value={{
                period: report.period
                  ? `${report.period.reference ?? ""} ${report.period.start_date} → ${report.period.end_date}`.trim()
                  : selectedPeriod
                    ? periodLabel(selectedPeriod)
                    : "—",
                status: report.status,
                reference: report.reference,
                version: report.version,
                department: selectedDept ? departmentLabel(selectedDept) : "—",
                items: report.items?.length ?? 0,
                blockers: report.blockers?.length ?? 0,
                submitted_in_scope: counts?.submitted ?? submitted.length,
                missing_staff: missingStaff.length,
              }}
            />
          </FormSection>

          <FormSection title="Missing staff" description="Staff in this department who have not submitted for the selected period." icon="person_off">
            {missingStaff.length === 0 ? (
              <p className="text-sm text-neutral-500">No missing staff in this department for the selected period.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Name</th>
                    </tr>
                  </thead>
                  <tbody>
                    {missingStaff.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{row.name ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection title="Submitted reports" description="Open a report to review it. Nothing is accepted or submitted from this page." icon="assignment">
            {submitted.length === 0 ? (
              <p className="text-sm text-neutral-500">No submitted reports linked to this rollup yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">Report</th>
                      <th className="py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {submitted.map((row) => (
                      <tr key={row.id} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">
                          <Link href={`/weekly-summaries/${row.id}`} className="font-medium text-primary hover:underline">
                            {row.label}
                          </Link>
                        </td>
                        <td className="py-2 capitalize">{row.status ?? "—"}</td>
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
