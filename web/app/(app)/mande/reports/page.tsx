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

type Tab = "strategic" | "donor";

export default function MandeReportsPage() {
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
    data.thematic_distribution.forEach((t) => {
      rows.push({
        section: "thematic_distribution",
        label: t.area_name,
        activities: t.activities,
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
      label: "Indicator coverage",
      activities: data.indicators.total,
      closed: data.indicators.updated,
      participants: "",
      coverage_pct: data.indicators.coverage_pct,
    });
    rows.push({
      section: "evidence",
      label: "Evidence coverage",
      activities: data.evidence_coverage.submitted_reports,
      closed: data.evidence_coverage.reports_with_evidence,
      participants: "",
      coverage_pct: data.evidence_coverage.coverage_pct,
    });
    exportToCsv("mande-strategic-report", rows, [
      { key: "section", header: "Section" },
      { key: "label", header: "Label" },
      { key: "activities", header: "Activities / Total" },
      { key: "closed", header: "Closed / Updated / With evidence" },
      { key: "participants", header: "Participants" },
      { key: "coverage_pct", header: "Coverage %" },
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
      { key: "reference", header: "Reference" },
      { key: "title", header: "Activity" },
      { key: "status", header: "Status" },
      { key: "pif", header: "PIF" },
      { key: "programme", header: "Programme" },
      { key: "start", header: "Start" },
      { key: "end", header: "End" },
      { key: "participants", header: "Participants" },
    ]);
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <ModulePageHeader
        title="Institutional Reports"
        subtitle="Strategic M&amp;E summary and donor/project activity matrix exports."
        breadcrumbs={<PageBreadcrumbs items={[{ label: "Institutional Reports" }]} />}
      />
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
          disabled={tab === "strategic" ? !strategic.data : !donor.data}
          onClick={tab === "strategic" ? downloadStrategicCsv : downloadDonorCsv}
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export CSV
        </button>
      </div>

      <div className="flex gap-2 border-b border-neutral-200">
        {(["strategic", "donor"] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`px-3 py-2 text-sm border-b-2 -mb-px ${
              tab === t
                ? "border-primary text-primary font-semibold"
                : "border-transparent text-neutral-500"
            }`}
            onClick={() => setTab(t)}
          >
            {t === "strategic" ? "Strategic" : "Donor / Project"}
          </button>
        ))}
      </div>

      {tab === "strategic" && (
        <>
          {strategic.isError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Failed to load strategic report.
            </div>
          )}
          {strategic.isLoading || !strategic.data ? (
            <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.indicators.coverage_pct}%</p>
                  <p className="text-[11px] text-neutral-500">Indicator coverage</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.evidence_coverage.coverage_pct}%</p>
                  <p className="text-[11px] text-neutral-500">Evidence coverage</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.activities_per_goal.length}</p>
                  <p className="text-[11px] text-neutral-500">Goals with activity</p>
                </div>
                <div className="card px-4 py-4">
                  <p className="text-2xl font-bold text-neutral-900">{strategic.data.underreported_areas.length}</p>
                  <p className="text-[11px] text-neutral-500">Under-reported PIFs</p>
                </div>
              </div>

              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-neutral-100">
                  <h2 className="text-sm font-semibold text-neutral-800">Activities per strategic goal</h2>
                </div>
                {strategic.data.activities_per_goal.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-neutral-400">No data.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr><th>Goal</th><th>Activities</th><th>Closed</th></tr>
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
              <label className="text-xs text-neutral-500 block mb-1">Results framework</label>
              <select
                className="input text-sm max-w-md"
                value={frameworkId}
                onChange={(e) => setFrameworkId(e.target.value)}
              >
                <option value="">All activities (no framework filter)</option>
                {(frameworks.data ?? []).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{f.donor_name ? ` — ${f.donor_name}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">Status</label>
              <select
                className="input text-sm"
                value={reviewStatus}
                onChange={(e) => setReviewStatus(e.target.value)}
              >
                <option value="">All</option>
                {["not_submitted", "submitted", "returned", "reviewed", "accepted", "closed"].map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">From</label>
              <input type="date" className="input text-sm" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-neutral-500 block mb-1">To</label>
              <input type="date" className="input text-sm" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          {donor.isError && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              Failed to load donor report.
            </div>
          )}
          {donor.isLoading || !donor.data ? (
            <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
          ) : (
            <>
              {donor.data.framework && (
                <p className="text-sm text-neutral-600">
                  Framework: <strong>{donor.data.framework.name}</strong>
                </p>
              )}
              {donor.data.summary && (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.activity_count}</p>
                    <p className="text-[11px] text-neutral-500">Activities</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.indicator_count}</p>
                    <p className="text-[11px] text-neutral-500">Indicators</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xl font-bold">{donor.data.summary.participants_sum}</p>
                    <p className="text-[11px] text-neutral-500">Participants</p>
                  </div>
                  <div className="card px-4 py-3">
                    <p className="text-xs text-neutral-600">
                      {Object.entries(donor.data.summary.by_status).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}
                    </p>
                    <p className="text-[11px] text-neutral-500 mt-1">By status</p>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="card overflow-hidden">
                  <div className="px-5 py-3 border-b border-neutral-100">
                    <h2 className="text-sm font-semibold text-neutral-800">
                      Activities ({donor.data.activities.length})
                    </h2>
                  </div>
                  {donor.data.activities.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-neutral-400">No activities.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Ref</th><th>Title</th><th>Status</th><th>PIF</th></tr>
                      </thead>
                      <tbody>
                        {donor.data.activities.slice(0, 50).map((a) => (
                          <tr key={a.id}>
                            <td className="font-mono text-xs">{a.reference_number}</td>
                            <td className="text-sm">{a.activity_title}</td>
                            <td className="text-xs">{a.review_status}</td>
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
                      Indicators ({donor.data.indicators.length})
                    </h2>
                  </div>
                  {donor.data.indicators.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-neutral-400">
                      Select a results framework to see indicator aggregation.
                    </p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr><th>Code</th><th>Name</th><th>Linked</th><th>Sum actual</th></tr>
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
