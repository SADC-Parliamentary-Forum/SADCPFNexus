"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { weeklyReportsApi } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

type FocusFilter = "all" | "late" | "missing" | "unaccepted";
type TableColumn = "reference" | "person" | "period" | "department" | "status" | "days";

const STATUS_LABELS: Record<string, string> = {
  draft: "weeklySummaries.status.draft",
  in_progress: "weeklySummaries.status.in_progress",
  ready: "weeklySummaries.status.ready",
  not_started: "weeklySummaries.status.not_started",
  submitted: "weeklySummaries.status.submitted",
  pending_review: "weeklySummaries.status.pending_review",
  resubmitted: "weeklySummaries.status.resubmitted",
  returned: "weeklySummaries.status.returned",
  accepted: "weeklySummaries.status.accepted",
  published: "weeklySummaries.status.published",
  exempted: "weeklySummaries.status.exempted",
  reopened: "weeklySummaries.status.reopened",
  missing: "weeklySummaries.status.missing",
  late: "weeklySummaries.status.late",
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

function humanStatus(status: unknown, t: Translate): string {
  if (status == null || status === "") return "—";
  const raw = String(status);
  if (STATUS_LABELS[raw]) return t(STATUS_LABELS[raw]);
  if (raw.startsWith("weeklySummaries.compliance.")) return t(raw);
  return raw.replace(/_/g, " ");
}

function ownerLabel(row: Record<string, unknown>, t: Translate): unknown {
  if (typeof row.employee_name === "string" && row.employee_name.trim()) return row.employee_name;
  if (row.employee) return row.employee;
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  return t("weeklySummaries.unknownOwner");
}

function personLabel(row: Record<string, unknown>, t: Translate): unknown {
  if (typeof row.name === "string" && row.name.trim()) return row.name;
  if (typeof row.employee_name === "string" && row.employee_name.trim()) return row.employee_name;
  if (row.employee) return row.employee;
  return t("weeklySummaries.unknownPerson");
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

function daysLate(due: unknown, t: Translate): string {
  if (due == null || due === "") return "—";
  const dueAt = new Date(String(due));
  if (!Number.isFinite(dueAt.getTime())) return "—";
  const days = Math.floor((Date.now() - dueAt.getTime()) / 86_400_000);
  if (days <= 0) return "—";
  return days === 1 ? t("weeklySummaries.oneDay") : t("weeklySummaries.days", { count: days });
}

function dueAt(row: Record<string, unknown>, periodFallback: Record<string, unknown> | null): unknown {
  const nestedPeriod = asRecord(row.period);
  return row.employee_due_at ?? nestedPeriod?.employee_due_at ?? periodFallback?.employee_due_at;
}

function matchesPerson(row: Record<string, unknown>, query: string, t: Translate): boolean {
  if (!query) return true;
  const haystack = [personLabel(row, t), ownerLabel(row, t), row.reference]
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
  const { t } = useI18n();
  const allLabel = t("weeklySummaries.allDepartments");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = "compliance-department-list";
  const options = useMemo(() => [allLabel, ...names], [allLabel, names]);

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
    onSelect(name === allLabel ? "" : name);
    setQuery(name === allLabel ? "" : name);
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
        placeholder={t("weeklySummaries.compliance.searchDepartment")}
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
          aria-label={t("weeklySummaries.department.departments")}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-neutral-200 bg-white shadow-lg"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-neutral-500">{t("weeklySummaries.department.noMatch")}</li>
          ) : (
            filtered.map((name, index) => (
              <li key={name} role="presentation">
                <button
                  type="button"
                  role="option"
                  id={`compliance-dept-option-${index}`}
                  aria-selected={(selected || allLabel) === name}
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
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("weeklySummaries.compliance.loadFailed"));
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
    { label: "weeklySummaries.status.late", value: lateCount },
    { label: "weeklySummaries.status.missing", value: missing.length },
    { label: "weeklySummaries.compliance.unaccepted", value: unacceptedCount },
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
        finding: "weeklySummaries.compliance.finding.late",
        employee_name: t("weeklySummaries.compliance.yourReport"),
      });
    }
    if (pastDue) {
      for (const row of missing) {
        rows.push({ ...row, finding: "weeklySummaries.compliance.finding.lateNotSubmitted", status: "late" });
      }
    }
    return rows.filter((row) => matchesPerson(row, query, t) && matchesDepartment(row, departmentName));
  }, [departmentName, missing, myReport, myReportLate, pastDue, query, t]);

  const missingRows = useMemo(
    () => missing.filter((row) => matchesPerson(row, query, t) && matchesDepartment(row, departmentName)),
    [departmentName, missing, query, t],
  );

  const unacceptedRows = useMemo(() => {
    const rows = [...unaccepted];
    const alreadyListed = new Set(rows.map((row) => reportId(row)).filter((id): id is number => id != null));
    if (myReportUnaccepted && myReport) {
      const id = reportId(myReport);
      if (id && !alreadyListed.has(id)) {
        rows.unshift({ ...myReport, employee_name: t("weeklySummaries.compliance.yourReport") });
      }
    }
    return rows.filter((row) => matchesPerson(row, query, t) && matchesDepartment(row, departmentName));
  }, [departmentName, myReport, myReportUnaccepted, query, unaccepted, t]);

  const trendSummary = asRecord(trends?.summary);
  const showLate = focus === "all" || focus === "late";
  const showMissing = focus === "all" || focus === "missing";
  const showUnaccepted = focus === "all" || focus === "unaccepted";
  const dueLabel = shortDate(period?.employee_due_at);
  const periodDescription = [
    periodLabel(period),
    dueLabel ? t("weeklySummaries.compliance.dueOn", { date: dueLabel }) : "",
    pastDue ? t("weeklySummaries.compliance.duePassed") : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const exportMissingCsv = () => {
    const lines = [
      t("weeklySummaries.compliance.csvHeader"),
      ...missingRows.map((row) => {
        const person = String(labelledText(personLabel(row, t)) || t("weeklySummaries.unknownPerson")).replaceAll('"', '""');
        const department = String(labelledText(departmentLabel(row)) || "—").replaceAll('"', '""');
        const periodText = periodLabel(row.period ?? period).replaceAll('"', '""');
        const finding = pastDue ? t("weeklySummaries.compliance.finding.lateNotSubmitted") : t("weeklySummaries.compliance.finding.notSubmitted");
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
    setNotice(t("weeklySummaries.compliance.exported"));
  };

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="weeklySummaries.compliance.title"
        subtitle="weeklySummaries.compliance.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "weeklySummaries.crumb", href: "/weekly-summaries" },
              { label: "weeklySummaries.compliance.crumb" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {myReportId ? (
              <Link href={`/weekly-summaries/${myReportId}`} className="btn-secondary text-sm">
                {t("weeklySummaries.compliance.openYourReport")}
              </Link>
            ) : null}
            <button type="button" className="btn-secondary text-sm" onClick={() => void reload()} disabled={busy}>
              {t("weeklySummaries.compliance.refresh")}
            </button>
          </div>
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error === t("weeklySummaries.compliance.loadFailed") ? error : t("weeklySummaries.compliance.loadFailedWith", { error })}
        </div>
      ) : null}

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900" role="status">
          {notice}
        </div>
      ) : null}

      {busy ? (
        <div className="card space-y-3 p-6" aria-busy="true">
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {!busy && !error ? (
        <>
          <FormSection
            title="weeklySummaries.compliance.filters"
            description="weeklySummaries.compliance.filtersHint"
            icon="filter_alt"
          >
            <div className="grid gap-3 md:grid-cols-3">
              <FormField label="weeklySummaries.compliance.show" htmlFor="compliance-focus">
                <select
                  id="compliance-focus"
                  className="form-input"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value as FocusFilter)}
                >
                  <option value="all">{t("weeklySummaries.compliance.allFindings")}</option>
                  <option value="late">{t("weeklySummaries.status.late")}</option>
                  <option value="missing">{t("weeklySummaries.status.missing")}</option>
                  <option value="unaccepted">{t("weeklySummaries.compliance.unaccepted")}</option>
                </select>
              </FormField>
              <FormField label="weeklySummaries.col.person" htmlFor="compliance-person" hint="weeklySummaries.compliance.personHint">
                <input
                  id="compliance-person"
                  className="form-input"
                  value={personQuery}
                  onChange={(e) => setPersonQuery(e.target.value)}
                  placeholder={t("weeklySummaries.compliance.personPlaceholder")}
                />
              </FormField>
              <FormField label="weeklySummaries.col.department" htmlFor="compliance-department" hint="weeklySummaries.compliance.departmentHint">
                <DepartmentNamePicker names={departmentNames} selected={departmentName} onSelect={setDepartmentName} />
              </FormField>
            </div>
          </FormSection>

          <FormSection title="weeklySummaries.compliance.snapshot" description={periodDescription} icon="fact_check">
            <div className="grid gap-3 sm:grid-cols-3">
              {countCards.map((card) => (
                <div key={card.label} className="rounded-xl border border-neutral-100 bg-neutral-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{t(card.label)}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-neutral-900">{card.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-4">
              <LabelledRecord
                value={{
                  [t("weeklySummaries.detail.field.period")]: periodLabel(period),
                  [t("weeklySummaries.compliance.field.submitted")]: Number(compliance.submitted ?? 0),
                  [t("weeklySummaries.compliance.field.exempted")]: Number(compliance.exempted ?? 0),
                }}
              />
            </div>
            {trendSummary ? (
              <div className="mt-4 border-t border-neutral-100 pt-4">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">{t("weeklySummaries.compliance.last12")}</h3>
                <LabelledRecord
                  value={{
                    [t("weeklySummaries.compliance.field.reports")]: trendSummary.total_reports ?? 0,
                    [t("weeklySummaries.compliance.field.completed")]: trendSummary.completed ?? 0,
                    [t("weeklySummaries.trends.field.completionRate")]: `${trendSummary.completion_rate ?? 0}%`,
                    [t("weeklySummaries.trends.field.missingOrLate")]: trendSummary.missing_or_late ?? 0,
                  }}
                />
              </div>
            ) : null}
          </FormSection>

          {myReport ? (
            <FormSection
              title="weeklySummaries.compliance.yourReport"
              description="weeklySummaries.compliance.yourReportHint"
              icon="edit_calendar"
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.compliance.yourReportCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.reference")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.period")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th>
                      <th className="py-2 font-medium">{t("weeklySummaries.col.status")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-neutral-50">
                      <td className="py-2 pr-3">
                        {reportId(myReport) ? (
                          <Link
                            href={`/weekly-summaries/${reportId(myReport)}`}
                            className="font-medium text-primary"
                          >
                            {String(myReport.reference ?? t("weeklySummaries.compliance.openReport"))}
                          </Link>
                        ) : (
                          labelledObjectCell(myReport.reference ?? "—")
                        )}
                      </td>
                      <td className="py-2 pr-3">{labelledObjectCell(periodLabel(myReport.period ?? period))}</td>
                      <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(myReport))}</td>
                      <td className="py-2">{labelledObjectCell(humanStatus(myReport.status, t))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </FormSection>
          ) : null}

          {showLate ? (
            <FormSection
              title="weeklySummaries.compliance.late"
              description="weeklySummaries.compliance.lateHint"
              icon="schedule"
              actions={
                missingRows.length > 0 && pastDue ? (
                  <button type="button" className="btn-secondary text-sm" onClick={exportMissingCsv}>
                    {t("weeklySummaries.compliance.exportMissing")}
                  </button>
                ) : null
              }
            >
              {lateRows.length === 0 ? (
                <EmptyState
                  icon="check_circle"
                  title="weeklySummaries.compliance.noLate"
                  description={
                    pastDue
                      ? "weeklySummaries.compliance.noLateHint"
                      : "weeklySummaries.compliance.notDueYet"
                  }
                />
              ) : (
                <ComplianceTable
                  caption={t("weeklySummaries.compliance.lateCaption")}
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
              title="weeklySummaries.compliance.missing"
              description="weeklySummaries.compliance.missingHint"
              icon="person_off"
              actions={
                missingRows.length > 0 ? (
                  <button type="button" className="btn-secondary text-sm" onClick={exportMissingCsv}>
                    {t("weeklySummaries.compliance.exportMissing")}
                  </button>
                ) : null
              }
            >
              {missingRows.length === 0 ? (
                <EmptyState
                  icon="check_circle"
                  title="weeklySummaries.review.noMissing"
                  description="weeklySummaries.compliance.noMissingHint"
                />
              ) : (
                <ComplianceTable
                  caption={t("weeklySummaries.review.missingCaption")}
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
              title="weeklySummaries.compliance.unacceptedTitle"
              description="weeklySummaries.compliance.unacceptedHint"
              icon="pending_actions"
            >
              {unacceptedRows.length === 0 ? (
                <EmptyState
                  icon="inbox"
                  title="weeklySummaries.compliance.noUnaccepted"
                  description="weeklySummaries.compliance.noUnacceptedHint"
                />
              ) : (
                <ComplianceTable
                  caption={t("weeklySummaries.compliance.unacceptedCaption")}
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
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-neutral-100 text-neutral-500">
            {columns.includes("reference") ? <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.reference")}</th> : null}
            {columns.includes("person") ? <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.person")}</th> : null}
            {columns.includes("department") ? <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th> : null}
            {columns.includes("period") ? <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.period")}</th> : null}
            {columns.includes("days") ? <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.daysLate")}</th> : null}
            {columns.includes("status") ? <th className="py-2 font-medium">{t("weeklySummaries.col.status")}</th> : null}
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
                      <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary">
                        {String(row.reference ?? t("weeklySummaries.compliance.openReport"))}
                      </Link>
                    ) : (
                      labelledObjectCell(row.reference ?? t("weeklySummaries.compliance.noReportYet"))
                    )}
                  </td>
                ) : null}
                {columns.includes("person") ? (
                  <td className="py-2 pr-3">
                    {linkReports && id ? (
                      <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary">
                        {labelledObjectCell(personRows ? personLabel(row, t) : ownerLabel(row, t))}
                      </Link>
                    ) : (
                      labelledObjectCell(personRows ? personLabel(row, t) : ownerLabel(row, t))
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
                  <td className="py-2 pr-3">{labelledObjectCell(daysLate(dueAt(row, periodFallback), t))}</td>
                ) : null}
                {columns.includes("status") ? (
                  <td className="py-2">{labelledObjectCell(humanStatus(status, t))}</td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
