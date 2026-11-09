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
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

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

function daysLateLabel(row: Record<string, unknown>, t: Translate): string {
  const raw = row.days_late;
  const days = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(days) && days > 0) {
    return days === 1 ? t("weeklySummaries.oneDay") : t("weeklySummaries.days", { count: days });
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
  const { t } = useI18n();
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
        setError(errorMessage(e, t("weeklySummaries.review.loadFailed")));
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
      const haystack = [ownerLabel(row, t), row.reference]
        .map((value) => (typeof value === "string" ? value : labelledText(value)))
        .join(" ")
        .toLowerCase();
      return haystack.includes(staffTerm);
    });
  }, [queue, departmentName, staffTerm, t]);

  const filteredMissing = useMemo(() => {
    return missing.filter((row) => {
      if (departmentName && labelledText(departmentLabel(row)).toLowerCase() !== departmentName.toLowerCase()) {
        return false;
      }
      if (!staffTerm) return true;
      const haystack = [personLabel(row, t), ownerLabel(row, t)]
        .map((value) => (typeof value === "string" ? value : labelledText(value)))
        .join(" ")
        .toLowerCase();
      return haystack.includes(staffTerm);
    });
  }, [missing, departmentName, staffTerm, t]);

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="weeklySummaries.review.title"
        subtitle="weeklySummaries.review.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "weeklySummaries.crumb", href: "/weekly-summaries" },
              { label: "weeklySummaries.review.crumb" },
            ]}
          />
        }
      />

      {forbidden ? (
        <EmptyState
          icon="lock"
          title="weeklySummaries.review.forbidden"
          description="weeklySummaries.review.forbiddenHint"
        />
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">
          {error === t("weeklySummaries.review.loadFailed") ? error : t("weeklySummaries.review.loadFailedWith", { error })}
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

      {!busy && !error && !forbidden ? (
        <>
          <FormSection
            title="weeklySummaries.review.metrics"
            description="weeklySummaries.review.metricsHint"
            icon="monitoring"
          >
            <LabelledRecord
              value={{
                [t("weeklySummaries.review.field.pendingReview")]: pendingCount,
                [t("weeklySummaries.review.field.missingReports")]: missing.length,
                [t("weeklySummaries.review.field.overdue")]: overdueCount,
                [t("weeklySummaries.review.field.period")]: periodLabel(period),
              }}
            />
          </FormSection>

          <FormSection
            title="weeklySummaries.review.filter"
            description="weeklySummaries.review.filterHint"
            icon="filter_alt"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="weeklySummaries.staffName" htmlFor="weekly-review-staff">
                <input
                  id="weekly-review-staff"
                  className="form-input"
                  value={staffQuery}
                  onChange={(event) => setStaffQuery(event.target.value)}
                  placeholder={t("weeklySummaries.searchStaff")}
                />
              </FormField>
              <FormField label="weeklySummaries.col.department" htmlFor="weekly-review-department">
                <select
                  id="weekly-review-department"
                  className="form-input"
                  value={departmentName}
                  onChange={(event) => setDepartmentName(event.target.value)}
                >
                  <option value="">{t("weeklySummaries.allDepartments")}</option>
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
            title="weeklySummaries.review.pendingQueue"
            description="weeklySummaries.review.pendingQueueHint"
            icon="rate_review"
          >
            {filteredQueue.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="weeklySummaries.review.noPending"
                description="weeklySummaries.review.noPendingHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.review.pendingCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.reference")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.staff")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.period")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.status")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.submitted")}</th>
                      <th className="py-2 font-medium">{t("weeklySummaries.col.daysLate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredQueue.map((row, idx) => {
                      const id = reportId(row);
                      return (
                        <tr key={id ?? `pending-${idx}`} className="border-b border-neutral-50">
                          <td className="py-2 pr-3">
                            {id ? (
                              <Link href={`/weekly-summaries/${id}`} className="font-medium text-primary">
                                {String(row.reference ?? t("weeklySummaries.reportNumber", { id }))}
                              </Link>
                            ) : (
                              labelledObjectCell(row.reference ?? "—")
                            )}
                          </td>
                          <td className="py-2 pr-3">{labelledObjectCell(ownerLabel(row, t))}</td>
                          <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(row))}</td>
                          <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                          <td className="py-2 pr-3 capitalize">{labelledObjectCell(row.status ?? "—")}</td>
                          <td className="py-2 pr-3">{shortDate(row.submitted_at) || "—"}</td>
                          <td className="py-2">{daysLateLabel(row, t)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </FormSection>

          <FormSection
            title="weeklySummaries.review.missing"
            description="weeklySummaries.review.missingHint"
            icon="person_off"
          >
            {filteredMissing.length === 0 ? (
              <EmptyState
                icon="check_circle"
                title="weeklySummaries.review.noMissing"
                description="weeklySummaries.review.noMissingHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.review.missingCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.person")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.period")}</th>
                      <th className="py-2 font-medium">{t("weeklySummaries.col.daysLate")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMissing.map((row, idx) => (
                      <tr key={row.id != null && row.id !== "" ? String(row.id) : `missing-${idx}`} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{labelledObjectCell(personLabel(row, t))}</td>
                        <td className="py-2 pr-3">{labelledObjectCell(departmentLabel(row))}</td>
                        <td className="py-2 pr-3">{labelledObjectCell(periodLabel(row.period ?? period))}</td>
                        <td className="py-2">{daysLateLabel(row, t)}</td>
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
