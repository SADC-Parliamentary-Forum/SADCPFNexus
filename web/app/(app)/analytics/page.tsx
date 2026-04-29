"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { analyticsApi, type AnalyticsSummary } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const MONTHS_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ─── Module colour map for bar chart ─────────────────────────────────────────
const MODULE_COLORS: Record<string, { bar: string; bg: string; icon: string; iconColor: string }> = {
  travel:      { bar: "bg-blue-500",    bg: "bg-blue-50",    icon: "flight",          iconColor: "text-blue-500" },
  leave:       { bar: "bg-emerald-500", bg: "bg-emerald-50", icon: "event_busy",      iconColor: "text-emerald-600" },
  imprest:     { bar: "bg-amber-500",   bg: "bg-amber-50",   icon: "payments",        iconColor: "text-amber-600" },
  procurement: { bar: "bg-violet-500",  bg: "bg-violet-50",  icon: "shopping_cart",   iconColor: "text-violet-600" },
  finance:     { bar: "bg-sky-500",     bg: "bg-sky-50",     icon: "account_balance",  iconColor: "text-sky-600" },
  hr:          { bar: "bg-rose-500",    bg: "bg-rose-50",    icon: "people",          iconColor: "text-rose-500" },
  governance:  { bar: "bg-indigo-500",  bg: "bg-indigo-50",  icon: "gavel",           iconColor: "text-indigo-600" },
  assets:      { bar: "bg-orange-500",  bg: "bg-orange-50",  icon: "inventory",       iconColor: "text-orange-600" },
  workplan:    { bar: "bg-teal-500",    bg: "bg-teal-50",    icon: "calendar_month",  iconColor: "text-teal-600" },
};
const DEFAULT_MODULE_COLOR = { bar: "bg-neutral-400", bg: "bg-neutral-50", icon: "folder", iconColor: "text-neutral-500" };

const MODULE_URLS: Record<string, string> = {
  travel:      "/travel",
  leave:       "/leave",
  imprest:     "/imprest",
  procurement: "/procurement",
  finance:     "/finance",
  hr:          "/hr",
  governance:  "/governance",
  assets:      "/assets",
  workplan:    "/workplan",
};

function ModuleBarChart({ modules }: { modules: { module: string; label: string; count: number }[] }) {
  const router = useRouter();
  if (modules.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-neutral-300 gap-2">
        <span className="material-symbols-outlined text-[36px]">bar_chart</span>
        <p className="text-sm text-neutral-400">No module data available</p>
      </div>
    );
  }

  const totalCount = modules.reduce((s, m) => s + m.count, 0) || 1;
  const maxCount = Math.max(...modules.map((m) => m.count), 1);

  return (
    <div className="space-y-3">
      {modules.map((mod) => {
        const pct = Math.round((mod.count / totalCount) * 100);
        const barPct = Math.round((mod.count / maxCount) * 100);
        const colors = MODULE_COLORS[mod.module?.toLowerCase()] ?? DEFAULT_MODULE_COLOR;
        const url = MODULE_URLS[mod.module?.toLowerCase()];
        return (
          <div
            key={mod.module}
            className={`flex items-center gap-4 group ${url ? "cursor-pointer" : ""}`}
            onClick={() => url && router.push(url)}
            title={url ? `View ${mod.label || mod.module} records` : undefined}
          >
            {/* Module icon */}
            <div className={`h-8 w-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
              <span className={`material-symbols-outlined text-[16px] ${colors.iconColor}`}>{colors.icon}</span>
            </div>
            {/* Module label */}
            <div className={`w-24 text-sm font-medium shrink-0 capitalize truncate ${url ? "text-primary group-hover:underline" : "text-neutral-700 dark:text-neutral-300"}`}>
              {mod.label || mod.module}
            </div>
            {/* Bar track */}
            <div className="flex-1 h-7 bg-neutral-100 dark:bg-neutral-700/40 rounded-lg overflow-hidden">
              <div
                className={`h-full ${colors.bar} rounded-lg transition-all duration-500 group-hover:brightness-110`}
                style={{ width: `${Math.max(barPct, 1)}%` }}
              />
            </div>
            {/* Count */}
            <div className="w-14 text-right">
              <span className="text-sm font-bold text-neutral-900 dark:text-neutral-100">{mod.count.toLocaleString()}</span>
            </div>
            {/* Percentage + arrow */}
            <div className="w-10 text-right flex items-center justify-end gap-1">
              <span className="text-xs text-neutral-400">{pct}%</span>
              {url && <span className="material-symbols-outlined text-[12px] text-neutral-300 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all">arrow_forward</span>}
            </div>
          </div>
        );
      })}
      <div className="pt-2 border-t border-neutral-100 dark:border-neutral-700/30 flex justify-between text-xs text-neutral-400 dark:text-neutral-500">
        <span>Total requests across all modules</span>
        <span className="font-semibold text-neutral-600 dark:text-neutral-300">{totalCount.toLocaleString()}</span>
      </div>
    </div>
  );
}

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

const CELL_STYLE = ["bg-neutral-100 dark:bg-neutral-700/40", "bg-blue-100 dark:bg-blue-900/30", "bg-primary/30", "bg-primary"];

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
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden text-sm">
            {["MTD", "QTD", "YTD"].map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 font-medium transition-colors ${period === p ? "bg-primary text-white" : "bg-white dark:bg-[var(--dk-bg-elevated)] text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5"}`}>
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
              <p className="text-neutral-500 dark:text-neutral-400 text-sm font-medium mb-1">{k.label}</p>
              {loading ? (
                <div className="h-8 w-20 bg-neutral-100 dark:bg-neutral-700/40 rounded animate-pulse" />
              ) : (
                <h3 className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">{k.value}</h3>
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
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Submissions by Month</h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Requests across travel, leave & imprest modules.</p>
            </div>
            <Link href="/reports" className="text-primary hover:underline text-sm font-medium flex items-center gap-1">
              Full Report <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
          <div className="relative h-64 w-full">
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-6">
              {[0, 1, 2, 3].map(i => <div key={i} className="w-full border-t border-dashed border-neutral-200 dark:border-neutral-700/30" />)}
              <div className="w-full border-t border-neutral-200 dark:border-neutral-700/30" />
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
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">Module Activity</h3>
            <span className="text-xs bg-neutral-100 dark:bg-neutral-700/40 text-neutral-500 dark:text-neutral-400 px-2 py-1 rounded font-medium">All time</span>
          </div>
          {loading ? (
            <div className="flex-1 flex items-end justify-between gap-3 px-2 pb-2 animate-pulse">
              {[40, 75, 55, 90].map((h, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full">
                  <div className="w-full bg-neutral-100 dark:bg-neutral-700/40 rounded-t-sm" style={{ height: `${h * 1.8}px` }} />
                  <div className="h-3 w-8 bg-neutral-100 dark:bg-neutral-700/40 rounded" />
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
                  <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{b.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Module Activity Breakdown — horizontal bar chart (CSS only) */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
              <span className="material-symbols-outlined text-neutral-400 text-lg">bar_chart</span>
              Module Activity Breakdown
            </h3>
            <p className="text-sm text-neutral-500 dark:text-neutral-400">Request counts per module for the selected period.</p>
          </div>
          <span className="text-xs bg-neutral-100 dark:bg-neutral-700/40 text-neutral-500 dark:text-neutral-400 px-2 py-1 rounded font-medium">{period}</span>
        </div>
        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[85, 60, 45, 72, 38].map((w, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="h-3 w-20 bg-neutral-100 dark:bg-neutral-700/40 rounded" />
                <div className="flex-1 h-7 bg-neutral-100 dark:bg-neutral-700/40 rounded-lg" style={{ maxWidth: `${w}%` }} />
                <div className="h-3 w-8 bg-neutral-100 dark:bg-neutral-700/40 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <ModuleBarChart modules={data?.by_module ?? []} />
        )}
      </div>

      {/* Bottom row: heatmap + recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">grid_on</span>
                Peak Action Times
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">User activity heat map by day and hour (last 90 days).</p>
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
                <div className="text-left text-neutral-600 dark:text-neutral-400 font-medium self-center text-[11px]">{hour > 12 ? `${hour-12} PM` : `${hour} AM`}</div>
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
              <h3 className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="material-symbols-outlined text-neutral-400 text-lg">history</span>
                Recent Activity
              </h3>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Latest system events from the audit log.</p>
            </div>
            <Link href="/admin/audit" className="text-sm text-primary hover:underline">View All</Link>
          </div>
          {loading ? (
            <div className="space-y-3 animate-pulse">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-neutral-100 dark:bg-neutral-700/40 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-neutral-100 dark:bg-neutral-700/40 rounded w-3/4" />
                    <div className="h-2.5 bg-neutral-100 dark:bg-neutral-700/40 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(data?.recent_activity ?? []).map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-neutral-50 dark:hover:bg-white/5 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700 transition-all group cursor-pointer">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
                      <span className="material-symbols-outlined text-primary text-[18px]">history</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 group-hover:text-primary transition-colors">{r.event} · {r.module}</p>
                      <p className="text-xs text-neutral-400">{r.user} · {formatDateShort(r.timestamp)}</p>
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
