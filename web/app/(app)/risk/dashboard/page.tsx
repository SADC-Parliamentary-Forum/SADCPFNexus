"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { riskApi, type RiskDashboardData, type RiskMatrixData, type RiskDepartmentExposure } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStoredUser(): { roles?: string[] } | null {
  try { return JSON.parse(localStorage.getItem("sadcpf_user") ?? "null"); } catch { return null; }
}

function cellBg(score: number): string {
  if (score >= 16) return "bg-red-500 text-white";
  if (score >= 11) return "bg-orange-400 text-white";
  if (score >= 6)  return "bg-yellow-300 text-neutral-900";
  return "bg-green-200 text-neutral-900";
}

function deptGrade(row: RiskDepartmentExposure): { grade: string; cls: string } {
  if (row.critical === 0 && row.overdue_actions === 0) return { grade: "A", cls: "badge-success" };
  if (row.critical <= 1 && row.overdue_actions <= 2)   return { grade: "B", cls: "badge-warning" };
  if (row.critical <= 3)                               return { grade: "C", cls: "badge-warning" };
  return { grade: "D", cls: "badge-danger" };
}

const LEVEL_CONFIG: Record<string, { label: string; cls: string }> = {
  low:      { label: "Low",      cls: "text-green-700 bg-green-100 border-green-300"    },
  medium:   { label: "Medium",   cls: "text-yellow-700 bg-yellow-100 border-yellow-300" },
  high:     { label: "High",     cls: "text-orange-700 bg-orange-100 border-orange-300" },
  critical: { label: "Critical", cls: "text-red-700 bg-red-100 border-red-300"          },
};

const ESCALATION_CONFIG: Record<string, string> = {
  none:         "text-neutral-500 bg-neutral-100",
  departmental: "text-blue-700 bg-blue-50 border-blue-200",
  directorate:  "text-indigo-700 bg-indigo-50 border-indigo-200",
  sg:           "text-purple-700 bg-purple-50 border-purple-200",
  committee:    "text-teal-700 bg-teal-50 border-teal-200",
};

const CHANGE_TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  created:          { icon: "add_circle",   color: "text-primary"    },
  updated:          { icon: "edit",         color: "text-neutral-500" },
  submitted:        { icon: "send",         color: "text-amber-600"   },
  reviewed:         { icon: "rate_review",  color: "text-blue-600"    },
  approved:         { icon: "check_circle", color: "text-green-600"   },
  escalated:        { icon: "warning",      color: "text-red-600"     },
  closed:           { icon: "lock",         color: "text-neutral-600" },
  archived:         { icon: "archive",      color: "text-neutral-400" },
  reopened:         { icon: "refresh",      color: "text-teal-600"    },
  action_added:     { icon: "add_task",     color: "text-primary"     },
  action_completed: { icon: "task_alt",     color: "text-green-600"   },
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, icon, color, bg, href,
}: {
  label: string; value: number | string; icon: string; color: string; bg: string; href?: string;
}) {
  const inner = (
    <div className={`card px-4 py-4 flex items-center gap-3 ${href ? "hover:shadow-md transition-shadow cursor-pointer" : ""}`}>
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 ${bg}`}>
        <span className={`material-symbols-outlined text-[22px] ${color}`}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-neutral-900 leading-tight">{value}</p>
        <p className="text-xs text-neutral-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RiskDashboardPage() {
  const currentUser = typeof window !== "undefined" ? getStoredUser() : null;

  const { data: dashboard, isLoading: dashLoading } = useQuery({
    queryKey: ["risk", "dashboard"],
    queryFn: () => riskApi.getDashboard().then((r) => r.data.data as RiskDashboardData),
    staleTime: 60_000,
  });

  const { data: matrix } = useQuery({
    queryKey: ["risk", "matrix", "dashboard"],
    queryFn: () => riskApi.getMatrix({ exclude_closed: true }).then((r) => r.data),
    staleTime: 60_000,
  });

  const isExecutive = (currentUser?.roles ?? []).some((r) =>
    ["Secretary General", "Director", "System Admin", "super-admin"].includes(r)
  );
  const dashTitle = isExecutive ? "Institutional Risk Dashboard" : "Risk Dashboard";

  const kpis = dashboard?.kpis;

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{dashTitle}</h1>
          <p className="page-subtitle">Real-time risk exposure across all departments and categories.</p>
        </div>
        <Link href="/risk" className="btn-secondary flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">list</span>
          Full Register
        </Link>
      </div>

      {/* Row 1: 6 KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <KpiCard label="Open Risks"       value={dashLoading ? "—" : kpis?.open ?? 0}            icon="shield_moon"       color="text-amber-600"  bg="bg-amber-50"   href="/risk" />
        <KpiCard label="Critical"         value={dashLoading ? "—" : kpis?.critical ?? 0}        icon="crisis_alert"      color="text-red-600"    bg="bg-red-50"     href="/risk?risk_level=critical" />
        <KpiCard label="High"             value={dashLoading ? "—" : kpis?.high ?? 0}            icon="warning_amber"     color="text-orange-600" bg="bg-orange-50"  href="/risk?risk_level=high" />
        <KpiCard label="Overdue Actions"  value={dashLoading ? "—" : kpis?.overdue_actions ?? 0} icon="assignment_late"   color="text-red-600"    bg="bg-red-50"     />
        <KpiCard label="Escalated"        value={dashLoading ? "—" : kpis?.escalated ?? 0}       icon="escalator_warning" color="text-orange-600" bg="bg-orange-50"  href="/risk?status=escalated" />
        <KpiCard label="Reviews Due"      value={dashLoading ? "—" : kpis?.reviews_due ?? 0}     icon="event_upcoming"    color="text-blue-600"   bg="bg-blue-50"    />
      </div>

      {/* Row 2: Heatmap + Dept Exposure */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* 5×5 Heatmap */}
        <div className="card p-5">
          <div className="mb-3">
            <h2 className="text-sm font-semibold text-neutral-800">Risk Heatmap</h2>
            <p className="text-xs text-neutral-500">Likelihood × Impact — active risks only</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center justify-center w-5">
              <span className="text-[10px] text-neutral-400 -rotate-90 whitespace-nowrap">Likelihood →</span>
            </div>
            <div className="flex-1">
              <div className="grid gap-1" style={{ gridTemplateColumns: "20px repeat(5, 1fr)" }}>
                <div />
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="text-center text-[10px] text-neutral-400 font-medium pb-0.5">{i}</div>
                ))}
                {[5, 4, 3, 2, 1].map((l) => (
                  <>
                    <div key={`l${l}`} className="flex items-center justify-center text-[10px] text-neutral-400 font-medium">{l}</div>
                    {[1, 2, 3, 4, 5].map((im) => {
                      const score = l * im;
                      const cell  = matrix?.cells.find((c) => c.likelihood === l && c.impact === im);
                      const count = cell?.count ?? 0;
                      return (
                        <Link
                          key={`${l}-${im}`}
                          href={`/risk`}
                          className={`relative aspect-square rounded flex items-center justify-center text-xs font-bold transition-all hover:scale-105 ${cellBg(score)}`}
                          title={`L${l} × I${im} = ${score} (${count} risk${count !== 1 ? "s" : ""})`}
                        >
                          {count > 0 && <span className="text-[11px] font-bold">{count}</span>}
                        </Link>
                      );
                    })}
                  </>
                ))}
              </div>
              <div className="text-center text-[10px] text-neutral-400 mt-1.5">Impact →</div>
            </div>
          </div>
          <div className="flex gap-3 mt-3 flex-wrap">
            {[
              { label: "Low",      bg: "bg-green-200"  },
              { label: "Medium",   bg: "bg-yellow-300" },
              { label: "High",     bg: "bg-orange-400" },
              { label: "Critical", bg: "bg-red-500"    },
            ].map((z) => (
              <div key={z.label} className="flex items-center gap-1">
                <div className={`h-2.5 w-2.5 rounded ${z.bg}`} />
                <span className="text-[10px] text-neutral-500">{z.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Departmental Exposure */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-neutral-100">
            <h2 className="text-sm font-semibold text-neutral-800">Exposure by Department</h2>
          </div>
          {!dashboard?.by_department?.length ? (
            <p className="px-5 py-6 text-sm text-neutral-400">No department data available.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th className="text-center">Total</th>
                  <th className="text-center">Critical</th>
                  <th className="text-center">Overdue</th>
                  <th className="text-center">Grade</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.by_department.map((row) => {
                  const { grade, cls } = deptGrade(row);
                  return (
                    <tr key={row.department_id ?? "none"}>
                      <td className="font-medium text-neutral-800">{row.department_name}</td>
                      <td className="text-center text-sm">{row.total}</td>
                      <td className="text-center">
                        {row.critical > 0
                          ? <span className="text-xs font-semibold text-red-600">{row.critical}</span>
                          : <span className="text-xs text-neutral-300">—</span>}
                      </td>
                      <td className="text-center">
                        {row.overdue_actions > 0
                          ? <span className="text-xs font-semibold text-orange-600">{row.overdue_actions}</span>
                          : <span className="text-xs text-neutral-300">—</span>}
                      </td>
                      <td className="text-center">
                        <span className={`badge ${cls} text-xs font-bold`}>{grade}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Row 3: Escalated Risks + Action Summary */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Escalated Risks */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-red-500">warning</span>
              Escalated Risks
            </h2>
            <Link href="/risk?status=escalated" className="text-xs text-primary hover:underline">View all</Link>
          </div>
          {!dashboard?.escalated_risks?.length ? (
            <div className="py-4 text-center">
              <span className="material-symbols-outlined text-[32px] text-green-300 block mb-1">check_circle</span>
              <p className="text-xs text-neutral-400">No escalated risks — good standing.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {dashboard.escalated_risks.slice(0, 5).map((r) => {
                const lvl = LEVEL_CONFIG[r.risk_level] ?? LEVEL_CONFIG.low;
                const escCls = ESCALATION_CONFIG[r.escalation_level] ?? "text-neutral-500 bg-neutral-100";
                return (
                  <Link key={r.id} href={`/risk/${r.id}`} className="flex items-center gap-3 rounded-lg border border-neutral-100 px-3 py-2.5 hover:bg-neutral-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-neutral-400">{r.risk_code}</p>
                      <p className="text-sm font-medium text-neutral-800 line-clamp-1">{r.title}</p>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${lvl.cls}`}>{lvl.label}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full capitalize ${escCls}`}>
                        {r.escalation_level.replace("_", " ")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Summary */}
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-orange-500">assignment_late</span>
            Action Summary
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-center">
              <p className="text-3xl font-bold text-red-700">{kpis?.overdue_actions ?? "—"}</p>
              <p className="text-xs text-red-600 mt-1">Overdue Actions</p>
              <Link href="/risk" className="text-[10px] text-red-500 hover:underline mt-1 block">View risks →</Link>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-4 text-center">
              <p className="text-3xl font-bold text-blue-700">{kpis?.reviews_due ?? "—"}</p>
              <p className="text-xs text-blue-600 mt-1">Reviews Due (14d)</p>
              <Link href="/risk" className="text-[10px] text-blue-500 hover:underline mt-1 block">View risks →</Link>
            </div>
          </div>
          <div className="pt-2 border-t border-neutral-100">
            <p className="text-xs text-neutral-500">
              {kpis && kpis.overdue_actions === 0 && kpis.reviews_due === 0
                ? "All actions are on track and no reviews are immediately due."
                : "Immediate attention required on overdue actions and upcoming review cycles."}
            </p>
          </div>
        </div>
      </div>

      {/* Row 4: Recent Activity Timeline */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-neutral-800 flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-purple-500">history</span>
            Recent Activity
          </h2>
          <Link href="/risk/audit-trail" className="text-xs text-primary hover:underline">Full audit trail</Link>
        </div>

        {!dashboard?.recent_activity?.length ? (
          <p className="text-sm text-neutral-400">No recent activity.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-3 top-0 bottom-0 w-px bg-neutral-200" />
            <div className="space-y-3">
              {dashboard.recent_activity.map((event) => {
                const cfg = CHANGE_TYPE_ICONS[event.change_type] ?? { icon: "info", color: "text-neutral-500" };
                return (
                  <div key={event.id} className="flex gap-3 relative">
                    <div className="h-7 w-7 rounded-full bg-white border-2 border-neutral-200 flex items-center justify-center flex-shrink-0 z-10">
                      <span className={`material-symbols-outlined text-[13px] ${cfg.color}`}>{cfg.icon}</span>
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/risk/${event.risk_id}`} className="font-mono text-xs text-primary hover:underline">{event.risk_code}</Link>
                        <span className="text-xs text-neutral-600 capitalize">{event.change_type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-neutral-400">by {event.actor_name}</span>
                      </div>
                      <p className="text-[10px] text-neutral-400 mt-0.5">{formatDateShort(event.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
