"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  mandeApi,
  type MeDonorReport,
  type MeStrategicReport,
  type ResultsFramework,
} from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";
import { EmptyState } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";
import { reviewStatusLabel } from "@/lib/mandeStatusLabels";

type Tab = "strategic" | "donor";

export default function MandeReportsPage() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("strategic");
  const [frameworkId, setFrameworkId] = useState<string>("");
  const [reviewStatus, setReviewStatus] = useState<string>("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const strategic = useQuery({
    queryKey: ["mande", "strategic-report"],
    queryFn: () => mandeApi.getStrategicReport().then((r) => r.data.data as MeStrategicReport),
    staleTime: 30_000,
    enabled: tab === "strategic",
  });

  const frameworks = useQuery({
    queryKey: ["mande", "results-frameworks", "donor-filter"],
    queryFn: () =>
      mandeApi.listFrameworks({ per_page: 100 }).then((r) => r.data.data as ResultsFramework[]),
    staleTime: 60_000,
    enabled: tab === "donor",
  });

  const donorParams = useMemo(() => {
    const p: Record<string, string | number> = {};
    if (frameworkId) p.results_framework_id = Number(frameworkId);
    if (reviewStatus) p.review_status = reviewStatus;
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [frameworkId, reviewStatus, dateFrom, dateTo]);

  const donor = useQuery({
    queryKey: ["mande", "donor-report", donorParams],
    queryFn: () => mandeApi.getDonorReport(donorParams).then((r) => r.data.data as MeDonorReport),
    staleTime: 30_000,
    enabled: tab === "donor",
  });

  function downloadStrategicCsv() {
    const data = strategic.data;
    if (!data) return;
    const rows: Record<string, unknown>[] = [];
    data.activities_per_goal.forEach((g) => {
      rows.push({
        section: "activities_per_goal",
        label: g.goal_title,
        activities: g.activities,
        closed: g.closed,
        participants: "",
        coverage_pct: "",
      });
    });
    data.outputs_per_programme.forEach((p) => {
      rows.push({
        section: "outputs_per_programme",
        label: `${p.pif_number} — ${p.programme_title}`,
        activities: p.activities,
        closed: "",
        participants: p.participants,
        coverage_pct: "",
      });
    });
    data.thematic_distribution.forEach((td) => {
      rows.push({
        section: "thematic_distribution",
        label: td.area_name,
        activities: td.activities,
        closed: "",
        participants: "",
        coverage_pct: "",
      });
    });
    data.underreported_areas.forEach((u) => {
      rows.push({
        section: "underreported",
        label: `${u.pif_number} — ${u.title}`,
        activities: "",
        closed: "",
        participants: "",
        coverage_pct: "",
      });
    });
    rows.push({
      section: "indicators",
      label: t("mande.reports.indicatorCoverage"),
      activities: data.indicators.total,
      closed: data.indicators.updated,
      participants: "",
      coverage_pct: data.indicators.coverage_pct,
    });
    rows.push({
      section: "evidence",
      label: t("mande.reports.evidenceCoverage"),
      activities: data.evidence_coverage.submitted_reports,
      closed: data.evidence_coverage.reports_with_evidence,
      participants: "",
      coverage_pct: data.evidence_coverage.coverage_pct,
    });
    exportToCsv("mande-strategic-report", rows, [
      { key: "section", header: t("mande.reports.section") },
      { key: "label", header: t("mande.reports.label") },
      { key: "activities", header: t("mande.reports.activitiesTotal") },
      { key: "closed", header: t("mande.reports.closedUpdated") },
      { key: "participants", header: t("mande.reports.participants") },
      { key: "coverage_pct", header: t("mande.reports.coveragePct") },
    ]);
  }

  function downloadDonorCsv() {
    const data = donor.data;
    if (!data) return;
    const rows = data.activities.map((a) => ({
      reference: a.reference_number,
      title: a.activity_title,
      status: a.review_status,
      pif: a.pif_number ?? "",
      programme: a.programme_title ?? "",
      start: a.start_date ?? "",
      end: a.end_date ?? "",
      participants: a.actual_participants ?? "",
    }));
    exportToCsv("mande-donor-activities", rows, [
      { key: "reference", header: t("correspondence.col.reference") },
      { key: "title", header: t("mande.col.activity") },
      { key: "status", header: t("correspondence.col.status") },
      { key: "pif", header: t("mande.col.pif") },
      { key: "programme", header: t("mande.reports.programme") },
      { key: "start", header: t("fleet.col.start") },
      { key: "end", header: t("fleet.col.end") },
      { key: "participants", header: t("mande.reports.participants") },
    ]);
  }

  return (
    <div className="w-full min-w-0 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title={t("mande.reports.title")}
        subtitle={t("mande.reports.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("mande.reports.title") }]} />}
      />
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
          disabled={tab === "strategic" ? !strategic.data : !donor.data}
          onClick={tab === "strategic" ? downloadStrategicCsv : downloadDonorCsv}
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          {t("correspondence.exportCsv")}
        </button>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        {(["strategic", "donor"] as Tab[]).map((tb) => (
          <button
            key={tb}
            type="button"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === tb
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-neutral-500"
            }`}
            onClick={() => setTab(tb)}
          >
            {tb === "strategic" ? t("mande.reports.strategic") : t("mande.reports.donorProject")}
          </button>
        ))}
      </div>

      {tab === "strategic" && (
        <>
          {strategic.isError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {t("mande.reports.strategicFailed")}
            </div>
          )}
          {strategic.isLoading || !strategic.data ? (
            <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.indicators.coverage_pct}%</p>
                  <p className="text-[11px] text-neutral-500">{t("mande.reports.indicatorCoverage")}</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.evidence_coverage.coverage_pct}%</p>
                  <p className="text-[11px] text-neutral-500">{t("mande.reports.evidenceCoverage")}</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.activities_per_goal.length}</p>
                  <p className="text-[11px] text-neutral-500">{t("mande.reports.goalsWithActivity")}</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.underreported_areas.length}</p>
                  <p className="text-[11px] text-neutral-500">{t("mande.reports.underReported")}</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-800">{t("mande.reports.activitiesPerGoal")}</h2>
                </div>
                {strategic.data.activities_per_goal.length === 0 ? (
                  <EmptyState icon="flag" title={t("mande.reports.noData")} className="py-8 min-h-0" />
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>{t("mande.reports.goal")}</th><th>{t("mande.reports.activities")}</th><th>{t("mande.reports.closed")}</th></tr>
                    </thead>
                    <tbody>
                      {strategic.data.activities_per_goal.map((g, i) => (
                        <tr key={i}>
                          <td className="text-sm">{g.goal_title}</td>
                          <td className="text-xs">{g.activities}</td>
                          <td className="text-xs">{g.closed}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === "donor" && (
        <>
          <div className="card p-4 flex items-end gap-3 flex-wrap">
            <div>
              <label htmlFor="mande-reports-results-framework" className="text-xs text-neutral-500 block mb-1">{t("mande.reports.resultsFramework")}</label>
              <select id="mande-reports-results-framework"
                className="input text-sm max-w-md"
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
              >
                <option value="">{t("mande.reports.allActivities")}</option>
                {(frameworks.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.donor_name ? ` — ${f.donor_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mande-reports-status" className="text-xs text-neutral-500 block mb-1">{t("correspondence.col.status")}</label>
              <select id="mande-reports-status"
                className="input text-sm"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
              >
                <option value="">{t("imprest.list.all")}</option>
                {["not_submitted", "submitted", "returned", "reviewed", "accepted", "closed"].map((s) => (
                  <option key={s} value={s}>{reviewStatusLabel(t, s)}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="mande-reports-from" className="text-xs text-neutral-500 block mb-1">{t("fleet.utilisation.from")}</label>
              <input id="mande-reports-from" type="date" className="input text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label htmlFor="mande-reports-to" className="text-xs text-neutral-500 block mb-1">{t("fleet.utilisation.to")}</label>
              <input id="mande-reports-to" type="date" className="input text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {donor.isError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {t("mande.reports.donorFailed")}
            </div>
          )}
          {donor.isLoading || !donor.data ? (
            <div className="card px-5 py-10 text-center text-sm text-neutral-400">{t("common.loading")}</div>
          ) : (
            <>
              {donor.data.framework && (
                <p className="text-sm text-neutral-600">
                  {t("mande.reports.framework")} <strong>{donor.data.framework.name}</strong>
                </p>
              )}
              {donor.data.summary && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.activity_count}</p>
                    <p className="text-[11px] text-neutral-500">{t("mande.reports.activities")}</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.indicator_count}</p>
                    <p className="text-[11px] text-neutral-500">{t("mande.aggregation.indicators")}</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.participants_sum}</p>
                    <p className="text-[11px] text-neutral-500">{t("mande.reports.participants")}</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xs text-neutral-600">
                      {Object.entries(donor.data.summary.by_status).map(([k, v]) => `${reviewStatusLabel(t, k)}: ${v}`).join(" · ") || "—"}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">{t("mande.reports.byStatus")}</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-neutral-100">
                    <h2 className="text-sm font-semibold text-neutral-800">
                      {t("mande.reports.activitiesCount", { count: donor.data.activities.length })}
                    </h2>
                  </div>
                  {donor.data.activities.length === 0 ? (
                    <EmptyState icon="assignment" title={t("mande.reports.noActivities")} className="py-8 min-h-0" />
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>{t("mande.reports.ref")}</th><th>{t("mande.col.title")}</th><th>{t("correspondence.col.status")}</th><th>{t("mande.col.pif")}</th></tr>
                      </thead>
                      <tbody>
                        {donor.data.activities.slice(0, 50).map((a) => (
                          <tr key={a.id}>
                            <td className="font-mono text-xs">{a.reference_number}</td>
                            <td className="text-sm">{a.activity_title}</td>
                            <td className="text-xs">{reviewStatusLabel(t, a.review_status)}</td>
                            <td className="font-mono text-xs">{a.pif_number ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-neutral-100">
                    <h2 className="text-sm font-semibold text-neutral-800">
                      {t("mande.reports.indicatorsCount", { count: donor.data.indicators.length })}
                    </h2>
                  </div>
                  {donor.data.indicators.length === 0 ? (
                    <EmptyState
                      icon="speed"
                      title={t("mande.reports.selectFramework")}
                      className="py-8 min-h-0"
                    />
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>{t("fleet.col.code")}</th><th>{t("fleet.col.name")}</th><th>{t("mande.intake.linked")}</th><th>{t("mande.reports.sumActual")}</th></tr>
                      </thead>
                      <tbody>
                        {donor.data.indicators.map((ind) => (
                          <tr key={ind.id}>
                            <td className="font-mono text-xs">{ind.code ?? "—"}</td>
                            <td className="text-sm">{ind.name}</td>
                            <td className="text-xs">{ind.linked_activities}</td>
                            <td className="text-xs">{ind.sum_actual ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
