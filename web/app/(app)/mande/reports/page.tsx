"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { mandeApi, type MeStrategicReport } from "@/lib/api";
import { exportToCsv } from "@/lib/csvExport";

export default function MandeReportsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["mande", "strategic-report"],
    queryFn: () => mandeApi.getStrategicReport().then((r) => r.data.data as MeStrategicReport),
    staleTime: 30_000,
  });

  function downloadCsv() {
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

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">Institutional Reports</h1>
          <p className="page-subtitle">Strategic M&amp;E summary — activities, indicators, evidence and under-reported PIFs.</p>
        </div>
        <button
          type="button"
          className="btn-secondary flex items-center gap-1.5 text-sm disabled:opacity-40"
          disabled={!data || isLoading}
          onClick={downloadCsv}
        >
          <span className="material-symbols-outlined text-[16px]">download</span>
          Export CSV
        </button>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          Failed to load strategic report.
        </div>
      )}

      {isLoading || !data ? (
        <div className="card px-5 py-10 text-center text-sm text-neutral-400">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.indicators.coverage_pct}%</p>
              <p className="text-[11px] text-neutral-500">Indicator coverage</p>
              <p className="text-xs text-neutral-400 mt-1">{data.indicators.updated}/{data.indicators.total} updated</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.evidence_coverage.coverage_pct}%</p>
              <p className="text-[11px] text-neutral-500">Evidence coverage</p>
              <p className="text-xs text-neutral-400 mt-1">
                {data.evidence_coverage.reports_with_evidence}/{data.evidence_coverage.submitted_reports} reports
              </p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.activities_per_goal.length}</p>
              <p className="text-[11px] text-neutral-500">Goals with activity</p>
            </div>
            <div className="card px-4 py-4">
              <p className="text-2xl font-bold text-neutral-900">{data.underreported_areas.length}</p>
              <p className="text-[11px] text-neutral-500">Under-reported PIFs</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100">
                <h2 className="text-sm font-semibold text-neutral-800">Activities per strategic goal</h2>
              </div>
              {data.activities_per_goal.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">No data.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Goal</th><th>Activities</th><th>Closed</th></tr>
                  </thead>
                  <tbody>
                    {data.activities_per_goal.map((g, i) => (
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

            <div className="card overflow-hidden">
              <div className="px-5 py-3 border-b border-neutral-100">
                <h2 className="text-sm font-semibold text-neutral-800">Thematic distribution</h2>
              </div>
              {data.thematic_distribution.length === 0 ? (
                <p className="px-5 py-8 text-center text-sm text-neutral-400">No data.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr><th>Area</th><th>Activities</th></tr>
                  </thead>
                  <tbody>
                    {data.thematic_distribution.map((t, i) => (
                      <tr key={i}>
                        <td className="text-sm">{t.area_name}</td>
                        <td className="text-xs">{t.activities}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800">Outputs per programme</h2>
            </div>
            {data.outputs_per_programme.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-400">No data.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>PIF</th><th>Programme</th><th>Activities</th><th>Participants</th></tr>
                </thead>
                <tbody>
                  {data.outputs_per_programme.map((p, i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs">{p.pif_number}</td>
                      <td className="text-sm">{p.programme_title}</td>
                      <td className="text-xs">{p.activities}</td>
                      <td className="text-xs">{p.participants}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="px-5 py-3 border-b border-neutral-100">
              <h2 className="text-sm font-semibold text-neutral-800">Under-reported PIFs</h2>
            </div>
            {data.underreported_areas.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-neutral-400">None flagged.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr><th>PIF</th><th>Title</th></tr>
                </thead>
                <tbody>
                  {data.underreported_areas.map((u) => (
                    <tr key={u.id}>
                      <td className="font-mono text-xs">{u.pif_number}</td>
                      <td className="text-sm">{u.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
