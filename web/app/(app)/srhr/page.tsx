"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { deploymentsApi, researcherReportsApi, type StaffDeployment, type ResearcherReport } from "@/lib/api";

const deploymentStatusConfig: Record<string, { label: string; cls: string }> = {
  active:    { label: "Active",    cls: "badge-success" },
  completed: { label: "Completed", cls: "badge-muted"   },
  recalled:  { label: "Recalled",  cls: "badge-danger"  },
  suspended: { label: "Suspended", cls: "badge-warning" },
};

const reportStatusConfig: Record<string, { label: string; cls: string }> = {
  draft:              { label: "Draft",             cls: "badge-muted"    },
  submitted:          { label: "Submitted",         cls: "badge-primary"  },
  acknowledged:       { label: "Acknowledged",      cls: "badge-success"  },
  revision_requested: { label: "Revision Requested",cls: "badge-warning"  },
  archived:           { label: "Archived",          cls: "badge-muted"    },
};

export default function SrhrOverviewPage() {
  const [deployments, setDeployments] = useState<StaffDeployment[]>([]);
  const [reports, setReports]         = useState<ResearcherReport[]>([]);
  const [loading, setLoading]         = useState(true);

  useEffect(() => {
    Promise.all([
      deploymentsApi.list({ per_page: 5, status: "active" }),
      researcherReportsApi.list({ per_page: 5 }),
    ])
      .then(([dRes, rRes]) => {
        setDeployments(dRes.data.data ?? []);
        setReports(rRes.data.data ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  const activeCount    = deployments.filter((d) => d.status === "active").length;
  const submittedCount = reports.filter((r) => r.status === "submitted").length;
  const pendingAck     = reports.filter((r) => r.status === "submitted").length;
  const draftCount     = reports.filter((r) => r.status === "draft").length;

  const kpis = [
    { label: "Active Deployments",  value: activeCount,    icon: "transfer_within_a_station", color: "text-blue-600",   bg: "bg-blue-50"   },
    { label: "Reports Submitted",   value: submittedCount, icon: "summarize",                  color: "text-amber-600",  bg: "bg-amber-50"  },
    { label: "Pending Acknowledgement", value: pendingAck, icon: "hourglass_empty",            color: "text-orange-600", bg: "bg-orange-50" },
    { label: "Draft Reports",       value: draftCount,     icon: "draft",                      color: "text-neutral-500",bg: "bg-neutral-50"},
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="page-title">Field Researchers</h1>
        <p className="page-subtitle">
          Manage researcher deployments at member state parliaments and review activity reports.
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((k) => (
          <div key={k.label} className="card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{k.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">
                  {loading
                    ? <span className="inline-block h-7 w-10 animate-pulse rounded bg-neutral-100" />
                    : k.value}
                </p>
              </div>
              <div className={`h-11 w-11 rounded-xl ${k.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${k.color} text-[22px]`}>{k.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="flex flex-wrap gap-3">
        <Link href="/srhr/deployments/new" className="btn-primary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Deployment
        </Link>
        <Link href="/srhr/reports/new" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">add_notes</span>
          Submit Report
        </Link>
        <Link href="/srhr/parliaments" className="btn-secondary inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">account_balance</span>
          Parliaments
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Deployments */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">transfer_within_a_station</span>
              <h3 className="text-sm font-semibold text-neutral-900">Active Deployments</h3>
            </div>
            <Link href="/srhr/deployments" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {loading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-neutral-100 animate-pulse flex-shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 bg-neutral-100 rounded animate-pulse w-2/3" />
                      <div className="h-2.5 bg-neutral-100 rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))
              : deployments.length === 0
              ? (
                  <div className="px-5 py-8 text-center text-sm text-neutral-400">
                    No active deployments
                  </div>
                )
              : deployments.map((d) => (
                  <Link
                    key={d.id}
                    href={`/srhr/deployments/${d.id}`}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-bold text-blue-700">
                        {d.employee?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{d.employee?.name}</p>
                      <p className="text-xs text-neutral-500 truncate">{d.parliament?.name}</p>
                    </div>
                    <span className={`badge ${deploymentStatusConfig[d.status]?.cls ?? "badge-muted"} text-[10px] flex-shrink-0`}>
                      {deploymentStatusConfig[d.status]?.label}
                    </span>
                  </Link>
                ))}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="card">
          <div className="card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-[18px]">summarize</span>
              <h3 className="text-sm font-semibold text-neutral-900">Recent Reports</h3>
            </div>
            <Link href="/srhr/reports" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          <div className="divide-y divide-neutral-100">
            {loading
              ? [1, 2, 3].map((i) => (
                  <div key={i} className="px-5 py-3.5 space-y-1.5">
                    <div className="h-3 bg-neutral-100 rounded animate-pulse w-3/4" />
                    <div className="h-2.5 bg-neutral-100 rounded animate-pulse w-1/2" />
                  </div>
                ))
              : reports.length === 0
              ? (
                  <div className="px-5 py-8 text-center text-sm text-neutral-400">
                    No reports yet
                  </div>
                )
              : reports.map((r) => (
                  <Link
                    key={r.id}
                    href={`/srhr/reports/${r.id}`}
                    className="px-5 py-3.5 flex items-center gap-3 hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-900 truncate">{r.title}</p>
                      <p className="text-xs text-neutral-500">
                        {r.reference_number} · {r.employee?.name}
                      </p>
                    </div>
                    <span className={`badge ${reportStatusConfig[r.status]?.cls ?? "badge-muted"} text-[10px] flex-shrink-0`}>
                      {reportStatusConfig[r.status]?.label}
                    </span>
                  </Link>
                ))}
          </div>
        </div>
      </div>
    </div>
  );
}
