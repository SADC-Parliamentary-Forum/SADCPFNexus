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
import { useI18n } from "@/lib/i18n/LocaleProvider";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export default function WeeklySummaryDetailPage() {
  const { t } = useI18n();
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
      setError(t("weeklySummaries.detail.loadFailed"));
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
      setError(e instanceof Error ? e.message : t("weeklySummaries.detail.loadFailed"));
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
    <div className="w-full min-w-0 space-y-6">
      <ModulePageHeader
        title={report?.reference ?? t("weeklySummaries.detail.title")}
        subtitle="weeklySummaries.detail.subtitle"
        breadcrumbs={
          <PageBreadcrumbs
            items={[
              { label: "weeklySummaries.crumb", href: "/weekly-summaries" },
              { label: report?.reference ?? "weeklySummaries.detail.crumb" },
            ]}
          />
        }
      />

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      ) : null}

      {busy && !report ? (
        <div className="card space-y-3 p-6" aria-live="polite">
          <p className="text-sm text-neutral-500">{t("common.loading")}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-neutral-100" />
          ))}
        </div>
      ) : null}

      {report ? (
        <>
          <FormSection title="weeklySummaries.detail.report" description="weeklySummaries.detail.reportHint" icon="description">
            <LabelledRecord
              value={{
                [t("weeklySummaries.detail.field.reference")]: report.reference,
                [t("weeklySummaries.detail.field.type")]: report.report_type,
                [t("weeklySummaries.detail.field.status")]: report.status,
                [t("weeklySummaries.detail.field.version")]: report.version,
                [t("weeklySummaries.detail.field.period")]: report.period
                  ? `${report.period.reference} · ${formatDateShort(report.period.start_date)} → ${formatDateShort(report.period.end_date)}`
                  : "—",
              }}
            />
          </FormSection>

          <FormSection title="weeklySummaries.detail.items" description="weeklySummaries.detail.itemsHint" icon="list">
            {items.length === 0 ? (
              <EmptyState
                icon="notes"
                title="weeklySummaries.detail.noItems"
                description="weeklySummaries.detail.noItemsHint"
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-neutral-500">
                      <th className="p-2">{t("weeklySummaries.detail.col.section")}</th>
                      <th className="p-2">{t("weeklySummaries.detail.field.title")}</th>
                      <th className="p-2">{t("weeklySummaries.detail.col.narrative")}</th>
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
            title="weeklySummaries.detail.review"
            description="weeklySummaries.detail.reviewHint"
            icon="rule"
          >
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <FormField label="weeklySummaries.detail.returnReason" htmlFor="weekly-return-reason">
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
                      toast("error", e instanceof Error ? e.message : t("weeklySummaries.detail.acceptFailed"));
                    } finally {
                      setAccepting(false);
                    }
                  }}
                >
                  {accepting ? t("weeklySummaries.detail.accepting") : t("weeklySummaries.detail.accept")}
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
                      toast("error", e instanceof Error ? e.message : t("weeklySummaries.detail.returnFailed"));
                    } finally {
                      setReturning(false);
                    }
                  }}
                >
                  {returning ? t("weeklySummaries.detail.returning") : t("common.return")}
                </button>
              </div>
            </div>
          </FormSection>

          <FormSection title="common.export" description="weeklySummaries.detail.exportHint" icon="download">
            <div className="flex flex-wrap gap-2">
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "pdf")}>
                PDF {/* i18n-ignore */}
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "csv")}>
                Excel/CSV {/* i18n-ignore */}
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "word")}>
                Word {/* i18n-ignore */}
              </a>
              <a className="btn-secondary text-sm" href={weeklyReportsApi.exportUrl(report.id, "management-pack")}>
                {t("weeklySummaries.detail.managementPack")}
              </a>
            </div>
          </FormSection>
        </>
      ) : null}

      {!busy && !report && !error ? (
        <EmptyState
          icon="description"
          title="weeklySummaries.detail.notFound"
          description="weeklySummaries.detail.notFoundHint"
        />
      ) : null}
    </div>
  );
}
