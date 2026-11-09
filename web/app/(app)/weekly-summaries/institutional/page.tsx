"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { reportsApi, weeklyReportsApi, type WeeklyOpsReport } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { FormField, FormSection } from "@/components/ui/FormSection";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { useToast } from "@/components/ui/Toast";
import { LabelledRecord, labelledObjectCell } from "@/components/ui/LabelledRecord";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import type { TranslateVars } from "@/lib/i18n/messages";

type Translate = (key: string, vars?: TranslateVars) => string;

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
  const formatted = formatDateShort(String(value));
  return formatted === "—" ? "" : formatted;
}

function periodLabel(value: unknown, t: Translate): string {
  const rec = asRecord(value);
  if (!rec) return "—";
  const ref = rec.reference != null && rec.reference !== "" ? String(rec.reference) : "";
  const start = dateLabel(rec.start_date);
  const end = dateLabel(rec.end_date);
  const range = start && end ? `${start} → ${end}` : start || end;
  return [ref, range].filter(Boolean).join(" · ") || t("weeklySummaries.currentPeriod");
}

function numericId(value: unknown): number | null {
  const id = typeof value === "number" ? value : Number(value);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function departmentName(
  row: Record<string, unknown>,
  departments: Array<{ id: number; name: string }>,
  t: Translate,
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
  return t("weeklySummaries.unassigned");
}

function itemTitle(row: Record<string, unknown>, t: Translate): string {
  const title = row.title ?? row.narrative ?? row.reference;
  return title != null && title !== "" ? String(title) : t("weeklySummaries.institutional.consolidatedItem");
}

function sourceReportId(row: Record<string, unknown>): number | null {
  const structured = asRecord(row.structured);
  return numericId(structured?.source_report_id) ?? numericId(row.source_report_id);
}

export default function WeeklyInstitutionalPage() {
  const toast = useToast();
  const { t } = useI18n();
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
              name: String(row.name ?? row.code ?? t("weeklySummaries.col.department")),
            })).filter((row) => row.id > 0),
          );
        }

        const selected = dashPeriodId ?? numericId(periodRows[0]?.id);
        setPeriodId(selected ? String(selected) : "");
      } catch (e: unknown) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("weeklySummaries.institutional.loadFailed"));
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
          setError(e instanceof Error ? e.message : t("weeklySummaries.institutional.loadFailed"));
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
    for (const row of missing) bump(departmentName(row, departments, t), "missing");
    for (const row of items) {
      const structured = asRecord(row.structured) ?? {};
      bump(departmentName({ ...structured, ...row }, departments, t), "items");
    }
    return Array.from(counts.values());
  }, [missing, items, departments, t]);

  const publish = async () => {
    if (!report || publishing) return;
    setPublishing(true);
    setError(null);
    try {
      const { data } = await weeklyReportsApi.publish(report.id);
      setReport(data.data);
      toast.success(t("weeklySummaries.institutional.published"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("weeklySummaries.institutional.publishFailed"));
      toast.error(t("weeklySummaries.institutional.notPublished"), apiErrorMessage(e, t("weeklySummaries.institutional.publishFailed")));
    } finally {
      setPublishing(false);
    }
  };

  const errorCopy = error
    ? error === t("weeklySummaries.institutional.loadFailed") || error === t("weeklySummaries.institutional.publishFailed")
      ? error
      : t("weeklySummaries.institutional.loadFailedWith", { error })
    : null;

  return (
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title="weeklySummaries.institutional.title"
        subtitle="weeklySummaries.institutional.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "weeklySummaries.crumb", href: "/weekly-summaries" },
              { label: "weeklySummaries.institutional.crumb" },
            ]}
          />
        }
        actions={
          <div className="flex flex-wrap gap-2">
            {report ? (
              <Link href={`/weekly-summaries/${report.id}`} className="btn-secondary text-sm">
                {t("weeklySummaries.institutional.openDetail")}
              </Link>
            ) : null}
            <Link href="/weekly-summaries/department" className="btn-secondary text-sm">
              {t("weeklySummaries.departmentView")}
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
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {!busy ? (
        <FormSection
          title="weeklySummaries.reportingPeriod"
          description="weeklySummaries.institutional.periodHint"
          icon="edit_calendar"
        >
          {periods.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="weeklySummaries.noPeriods"
              description="weeklySummaries.institutional.noPeriodsHint"
            />
          ) : (
            <FormField label="weeklySummaries.col.period" htmlFor="institutional-period" hint="weeklySummaries.periodFieldHint">
              <select
                id="institutional-period"
                className="form-input max-w-xl"
                value={periodId}
                onChange={(e) => setPeriodId(e.target.value)}
              >
                <option value="">{t("weeklySummaries.selectPeriod")}</option>
                {periods.map((row) => (
                  <option key={String(row.id)} value={String(row.id)}>
                    {periodLabel(row, t)}
                    {numericId(row.id) === currentPeriodId ? ` · ${t("weeklySummaries.current")}` : ""}
                  </option>
                ))}
              </select>
            </FormField>
          )}
        </FormSection>
      ) : null}

      {!busy && periodId && loadingReport ? (
        <div className="card space-y-3 p-6" aria-busy="true">
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
          <div className="h-10 animate-pulse rounded bg-neutral-100" />
        </div>
      ) : null}

      {!busy && !loadingReport && periodId && !report && !error ? (
        <div className="card">
          <EmptyState
            icon="account_balance"
            title="weeklySummaries.institutional.empty"
            description="weeklySummaries.institutional.emptyHint"
          />
        </div>
      ) : null}

      {!busy && !loadingReport && report ? (
        <>
          <FormSection
            title="weeklySummaries.institutional.rollup"
            description={`${report.reference} · ${report.status}${selectedPeriod ? ` · ${periodLabel(selectedPeriod, t)}` : ""}`}
            icon="account_balance"
            actions={
              <button
                type="button"
                className="btn-primary text-sm"
                disabled={publishing || report.status === "published" || report.status === "closed"}
                onClick={() => void publish()}
              >
                {publishing ? t("weeklySummaries.institutional.publishing") : report.status === "published" ? t("weeklySummaries.institutional.publishedLabel") : t("weeklySummaries.institutional.publish")}
              </button>
            }
          >
            <LabelledRecord
              value={{
                [t("weeklySummaries.detail.field.period")]: periodLabel(report.period ?? selectedPeriod, t),
                [t("weeklySummaries.detail.field.status")]: report.status,
                [t("weeklySummaries.detail.field.reference")]: report.reference,
                [t("weeklySummaries.detail.field.version")]: `v${report.version}`,
                [t("weeklySummaries.institutional.field.publishedAt")]: report.published_at ?? t("weeklySummaries.institutional.notPublishedValue"),
              }}
            />
          </FormSection>

          <FormSection
            title="weeklySummaries.institutional.breakdown"
            description="weeklySummaries.institutional.breakdownHint"
            icon="account_tree"
          >
            {unitBreakdown.length === 0 ? (
              <EmptyState
                icon="group"
                title="weeklySummaries.institutional.noBreakdown"
                description="weeklySummaries.institutional.noBreakdownHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.institutional.breakdownCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.consolidatedItems")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.review.missing")}</th>
                      <th className="py-2 font-medium">{t("finance.hub.view")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unitBreakdown.map((row) => (
                      <tr key={row.department} className="border-b border-neutral-50">
                        <td className="py-2 pr-3">{labelledObjectCell(row.department)}</td>
                        <td className="py-2 pr-3">{row.items}</td>
                        <td className="py-2 pr-3">{row.missing}</td>
                        <td className="py-2">
                          <Link href="/weekly-summaries/department" className="font-medium text-primary">
                            {t("weeklySummaries.departmentView")}
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
            title="weeklySummaries.consolidatedItems"
            description="weeklySummaries.institutional.itemsHint"
            icon="layers"
          >
            {items.length === 0 && links.length === 0 ? (
              <EmptyState
                icon="inbox"
                title="weeklySummaries.institutional.noItems"
                description="weeklySummaries.institutional.noItemsHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.institutional.itemsCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.detail.field.title")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.detail.col.section")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.source")}</th>
                      <th className="py-2 font-medium">{t("weeklySummaries.detail.report")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(items.length > 0 ? items : links).map((row, idx) => {
                      const sourceId = sourceReportId(row) ?? numericId(row.source_report_id);
                      return (
                        <tr key={numericId(row.id) ?? `item-${idx}`} className="border-b border-neutral-50">
                          <td className="py-2 pr-3">{labelledObjectCell(itemTitle(row, t))}</td>
                          <td className="py-2 pr-3 capitalize">{labelledObjectCell(row.section_type ?? "consolidated")}</td>
                          <td className="py-2 pr-3">
                            {labelledObjectCell(row.source_reference_snapshot ?? row.source_entity_type ?? "—")}
                          </td>
                          <td className="py-2">
                            {sourceId ? (
                              <Link href={`/weekly-summaries/${sourceId}`} className="font-medium text-primary">
                                {t("weeklySummaries.openSource")}
                              </Link>
                            ) : report ? (
                              <Link href={`/weekly-summaries/${report.id}`} className="font-medium text-primary">
                                {t("weeklySummaries.institutional.openRollup")}
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
            title="weeklySummaries.review.missing"
            description={
              viewingCurrentPeriod
                ? "weeklySummaries.institutional.missingHint"
                : "weeklySummaries.institutional.missingOtherHint"
            }
            icon="person_off"
          >
            {!viewingCurrentPeriod ? (
              <p className="mb-4 text-sm text-neutral-500">
                {t("weeklySummaries.institutional.missingScope")}
              </p>
            ) : null}
            {missing.length === 0 ? (
              <EmptyState
                icon="check_circle"
                title="weeklySummaries.review.noMissing"
                description="weeklySummaries.institutional.noMissingHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">{t("weeklySummaries.review.missingCaption")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-100 text-neutral-500">
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.person")}</th>
                      <th className="py-2 pr-3 font-medium">{t("weeklySummaries.col.department")}</th>
                      <th className="py-2 font-medium">{t("weeklySummaries.col.period")}</th>
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
                            typeof row.name === "string" && row.name.trim() ? row.name : t("weeklySummaries.unknownPerson"),
                          )}
                        </td>
                        <td className="py-2 pr-3">{labelledObjectCell(departmentName(row, departments, t))}</td>
                        <td className="py-2">{labelledObjectCell(periodLabel(row.period ?? selectedPeriod, t))}</td>
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
