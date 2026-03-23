"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { analyticsApi, type AnalyticsSummary } from "@/lib/api";

const MONTHS_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Build SVG polyline path from data points
function buildPath(pts: number[], w: number, h: number): string {
  if (pts.length === 0) return "";
  const max = Math.max(...pts, 1);
  return pts
    .map((v, i) => {
      const x = (i / Math.max(pts.length - 1, 1)) * w;
      const y = h - (v / max) * h * 0.9;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

const CELL_STYLE = ["bg-neutral-100", "bg-blue-100", "bg-primary/30", "bg-primary"];

function heatmapLevel(count: number, max: number): number {
  if (count === 0) return 0;
  if (count < max * 0.25) return 1;
  if (count < max * 0.6) return 2;
  return 3;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("YTD");
  const [dept, setDept] = useState("All");

  useEffect(() => {
    analyticsApi.summary()
      .then((res) => setData(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Derive chart data from API
  const monthlyPoints = data?.monthly_submissions?.map((m) => m.count) ?? [];
  const monthlyLabels = data?.monthly_submissions?.map((m) => m.label) ?? MONTHS_LABELS;
  const pathD = buildPath(monthlyPoints, 800, 260);
  const areaD = pathD ? pathD + " L800,260 L0,260 Z" : "";

  const barData = (data?.by_module ?? []).map((m) => {
    const max = Math.max(...(data?.by_module ?? []).map((x) => x.count), 1);
    return { label: m.label.slice(0, 4), val: m.count, pct: Math.round((m.count / max) * 100) };
  });

  // Heatmap grid: rows=hours [9,12,15,18], cols=Mon-Sun (dow 1-7)
  const HOUR_SLOTS = [9, 12, 15, 18];
  const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heatmapMap: Record<string, number> = {};
  (data?.activity_heatmap ?? []).forEach((h) => { heatmapMap[`${h.day}-${h.hour}`] = h.count; });
  const maxHeat = Math.max(...Object.values(heatmapMap), 1);

  const kpi = data?.kpi ?? { total_submissions: 0, approval_rate_pct: 0, active_travel: 0 };
  const kpiCards = [
    { label: "Total Submissions", value: loading ? "—" : kpi.total_submissions.toLocaleString(), trend: null, icon: "description", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
    { label: "Approval Rate", value: loading ? "—" : `${kpi.approval_rate_pct}%`, trend: null, icon: "fact_check", iconBg: "bg-purple-100", iconColor: "text-purple-600" },
    { label: "Active Travel", value: loading ? "—" : kpi.active_travel.toLocaleString(), trend: null, icon: "flight_takeoff", iconBg: "bg-orange-100", iconColor: "text-orange-600" },
  ];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Analytics Dashboard</h1>
          <p className="page-subtitle">Cross-module performance insights and operational intelligence.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg border border-neutral-200 overflow-hidden text-sm">
            {["MTD", "QTD", "YTD"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${period === p ? "bg-primary text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[18px]">domain</span>
            <select className="form-input pl-8 pr-8 py-1.5 text-sm" value={dept} onChange={e => setDept(e.target.value)}>
              <option>All</option>
              <option>HR</option>
              <option>Finance</option>
              <option>Operations</option>
              <option>IT</option>
            </select>
          </div>
          <Link href="/analytics/ledger" className="btn-secondary text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[18px]">receipt_long</span>
            Audit Ledger
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {kpiCards.map(k => (
          <div key={k.label} className="card p-6 flex flex-col justify-between gap-4 hover:border-primary/40 transition-colors">
            <div className="flex justify-between items-start">
              <div className={`p-2 rounded-lg ${k.iconBg} ${k.iconColor}`}>
                <span className="material-symbols-outlined text-xl">{k.icon}</span>
              </div>
            </div>
            <div>
              <p className="text-neutral-500 text-sm font-medium mb-1">{k.label}</p>
              {loading ? (
                <div className="h-8 w-20 bg-neutral-100 rounded animate-pulse" />
              ) : (
                <h3 className="text-3xl font-bold text-neutral-900">{k.value}</h3>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Line chart */}
        <div className="lg:col-span-2 card p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-neutral-900">Submissions by Month</h3>
              <p className="text-sm text-neutral-500">Requests across travel, leave & imprest modules.</p>
            </div>
            <Link href="/reports" className="text-primary hover:underline text-sm font-medium flex items-center gap-1">
              Full Report <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="relative h-64 w-full">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-neutral-200" />)}
              <div className="w-full border-t border-neutral-200" />
            </div>
            {loading ? (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-neutral-300 text-[32px]">progress_activity</span>
              </div>
            ) : (
              <svg viewBox="0 0 800 260" className="absolute inset-0 w-full h-full pb-6" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="areaGrad" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#1d85ed" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#1d85ed" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {areaD && <path d={areaD} fill="url(#areaGrad)" />}
                {pathD && <path d={pathD} fill="none" stroke="#1d85ed" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />}
              </svg>
            )}
            <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-neutral-400 px-1">
              {monthlyLabels.map((m, i) => <span key={i}>{m}</span>)}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-neutral-900">Module Activity</h3>
            <span className="text-xs bg-neutral-100 text-neutral-500 px-2 py-1 rounded font-medium">All time</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-end justify-between gap-3 px-2 pb-2 animate-pulse">
              {[40, 75, 55, 90].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full">
                  <div className="w-full bg-neutral-100 rounded-t-sm" style={{ height: `${h * 1.8}px` }} />
                  <div className="h-3 w-8 bg-neutral-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex-1 flex items-end justify-between gap-3 px-2 pb-2">
              {barData.map(b => (
                <div key={b.label} className="flex flex-col items-center gap-2 w-full group cursor-pointer">
                  <div className="w-full bg-blue-200 rounded-t-sm relative transition-all group-hover:bg-primary" style={{ height: `${Math.max(b.pct * 1.8, 4)}px` }}>
                    <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-neutral-800 text-white text-xs py-1 px-2 rounded shadow-lg whitespace-nowrap z-10">
                      {b.label}: {b.val}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-neutral-500">{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: heatmap + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">grid_on</span>
                Peak Action Times
              </h3>
              <p className="text-sm text-neutral-500">User activity heat map by day and hour (last 90 days).</p>
            </div>
            <div className="flex items-center gap-1.5">
              {CELL_STYLE.map((c, i) => <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />)}
            </div>
          </div>
          <div className="grid grid-cols-8 gap-2 text-xs text-neutral-400 text-center">
            <div />
            {DOW_LABELS.map(d => <div key={d} className="font-medium">{d}</div>)}
            {HOUR_SLOTS.map((hour) => (
              <React.Fragment key={hour}>
                <div className="text-left text-neutral-600 font-medium self-center text-[11px]">{hour > 12 ? `${hour-12} PM` : `${hour} AM`}</div>
                {[1, 2, 3, 4, 5, 6, 0].map((dow) => {
                  const count = heatmapMap[`${dow}-${hour}`] ?? 0;
                  const level = heatmapLevel(count, maxHeat);
                  return (
                    <div key={dow} className={`h-8 rounded transition-transform hover:scale-110 cursor-pointer ${CELL_STYLE[level]}`} title={`${count} events`}>
                      {level === 3 && <div className="w-full h-full flex items-center justify-center text-white text-[10px] font-bold">Hi</div>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="card p-6 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-neutral-900 flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">history</span>
                Recent Activity
              </h3>
              <p className="text-sm text-neutral-500">Latest system events from the audit log.</p>
            </div>
            <Link href="/admin/audit" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-neutral-100 rounded w-3/4" />
                    <div className="h-2.5 bg-neutral-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(data?.recent_activity ?? []).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 border border-transparent hover:border-neutral-200 transition-all group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
                      <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 group-hover:text-primary transition-colors">{r.event} · {r.module}</p>
                      <p className="text-xs text-neutral-400">{r.user} · {r.timestamp}</p>
                    </div>
                  </div>
                </div>
              ))}
              {(data?.recent_activity ?? []).length === 0 && (
                <div className="text-center py-8 text-neutral-400 text-sm">No recent activity</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
