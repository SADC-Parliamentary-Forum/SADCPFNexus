"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { leaveApi, tenantUsersApi, hrSettingsApi, type LeaveRequest, type TenantUserOption } from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffLeaveRow {
  user: TenantUserOption;
  annualUsed: number;
  annualTotal: number;
  sickUsed: number;
  sickTotal: number;
  lilHours: number;
  maternityDays: number;
  paternityDays: number;
  onLeaveToday: boolean;
  upcomingLeave: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TODAY = new Date();
TODAY.setHours(0, 0, 0, 0);

const NEXT_7 = new Date(TODAY);
NEXT_7.setDate(TODAY.getDate() + 7);

function parseDate(s: string): Date {
  return new Date(s + "T00:00:00");
}

function avatarColor(name: string): string {
  const colors = [
    "bg-blue-500", "bg-violet-500", "bg-emerald-500",
    "bg-amber-500", "bg-rose-500", "bg-indigo-500",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash += name.charCodeAt(i);
  return colors[hash % colors.length];
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

function UtilBar({ used, total, colorClass }: { used: number; total: number; colorClass: string }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="space-y-1 w-full min-w-[100px]">
      <div className="h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-[10px] text-neutral-400">{used}d used of {total}d</p>
    </div>
  );
}

function utilColorClass(used: number, total: number): string {
  if (total === 0) return "bg-neutral-300";
  const remaining = ((total - used) / total) * 100;
  if (remaining > 50) return "bg-green-500";
  if (remaining >= 25) return "bg-amber-400";
  return "bg-red-500";
}

function StatCard({
  icon, label, value, sub, iconBg, iconColor,
}: {
  icon: string; label: string; value: string | number; sub?: string;
  iconBg: string; iconColor: string;
}) {
  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0", iconBg)}>
        <span className={cn("material-symbols-outlined text-[22px]", iconColor)}>{icon}</span>
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1">{label}</p>
        <p className="text-2xl font-bold text-neutral-900 leading-none">{value}</p>
        {sub && <p className="text-xs text-neutral-400 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr>
      {[1, 2, 3, 4, 5, 6].map((i) => (
        <td key={i}>
          <div className="h-4 bg-neutral-100 rounded animate-pulse max-w-[120px]" />
        </td>
      ))}
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveBalancesPage() {
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOnLeave, setFilterOnLeave] = useState(false);

  const { data: profilesData } = useQuery({
    queryKey: ["hr-settings", "leave-profiles"],
    queryFn: () => hrSettingsApi.listLeaveProfiles().then((r) => r.data.data),
  });

  const activeProfile = (profilesData ?? []).find((p) => p.is_active) ?? null;
  const annualEntitlement   = activeProfile?.annual_leave_days  ?? 21;
  const sickEntitlement     = activeProfile?.sick_leave_days    ?? 30;
  const maternityEntitlement = activeProfile?.maternity_days    ?? 90;
  const paternityEntitlement = activeProfile?.paternity_days    ?? 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, leaveRes] = await Promise.all([
          tenantUsersApi.list(),
          leaveApi.list({ per_page: 200, status: "approved" }),
        ]);
        const usersData: TenantUserOption[] = (usersRes.data as { data?: TenantUserOption[] }).data ?? (Array.isArray(usersRes.data) ? (usersRes.data as unknown as TenantUserOption[]) : []);
        setUsers(usersData);
        setRequests(leaveRes.data.data ?? []);
      } catch {
        setError("Failed to load leave data. You may need HR administrator permissions.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Build per-staff balance rows by aggregating approved leave
  const rows: StaffLeaveRow[] = useMemo(() => {
    return users.map((user) => {
      const userReqs = requests.filter((r) => r.requester?.id === user.id);

      const annualUsed = userReqs
        .filter((r) => r.leave_type === "annual")
        .reduce((sum, r) => sum + (r.days_requested ?? 0), 0);
      const sickUsed = userReqs
        .filter((r) => r.leave_type === "sick")
        .reduce((sum, r) => sum + (r.days_requested ?? 0), 0);
      const lilHours = userReqs
        .filter((r) => r.leave_type === "lil")
        .reduce((sum, r) => sum + ((r.lil_hours_linked ?? 0)), 0);
      const maternityDays = userReqs
        .filter((r) => r.leave_type === "maternity")
        .reduce((sum, r) => sum + (r.days_requested ?? 0), 0);
      const paternityDays = userReqs
        .filter((r) => r.leave_type === "paternity")
        .reduce((sum, r) => sum + (r.days_requested ?? 0), 0);

      // Check if on leave today
      const onLeaveToday = userReqs.some((r) => {
        const start = parseDate(r.start_date);
        const end = parseDate(r.end_date);
        return TODAY >= start && TODAY <= end;
      });

      // Check if has approved leave in next 7 days
      const upcomingLeave = userReqs.some((r) => {
        const start = parseDate(r.start_date);
        return start > TODAY && start <= NEXT_7;
      });

      return {
        user,
        annualUsed,
        annualTotal: annualEntitlement,
        sickUsed,
        sickTotal: sickEntitlement,
        lilHours,
        maternityDays,
        paternityDays,
        onLeaveToday,
        upcomingLeave,
      };
    });
  }, [users, requests, annualEntitlement, sickEntitlement]);

  const filtered = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter((row) =>
        row.user.name.toLowerCase().includes(q) ||
        (row.user.email ?? "").toLowerCase().includes(q) ||
        (row.user.job_title ?? "").toLowerCase().includes(q)
      );
    }
    if (filterOnLeave) {
      r = r.filter((row) => row.onLeaveToday);
    }
    return r;
  }, [rows, search, filterOnLeave]);

  // Stats
  const totalStaff = rows.length;
  const staffOnLeaveToday = rows.filter((r) => r.onLeaveToday).length;
  const upcomingCount = rows.filter((r) => r.upcomingLeave).length;
  const avgAnnualRemaining =
    rows.length > 0
      ? Math.round(
          rows.reduce((sum, r) => sum + Math.max(0, r.annualTotal - r.annualUsed), 0) / rows.length
        )
      : 0;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <nav className="flex items-center gap-1.5 text-xs text-neutral-400 mb-2">
            <Link href="/hr" className="hover:text-primary transition-colors font-medium">HR</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <Link href="/hr/leave" className="hover:text-primary transition-colors font-medium">Leave</Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700 font-medium">Balances</span>
          </nav>
          <h1 className="page-title">Leave Balance Administration</h1>
          <p className="page-subtitle mt-1">
            Consolidated view of annual, sick, LIL, maternity &amp; paternity leave across all staff.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/hr/leave" className="btn-secondary py-2 px-3 text-sm flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px]">event_note</span>
            Leave Requests
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon="groups"
          label="Total Staff"
          value={totalStaff}
          sub="in the system"
          iconBg="bg-primary/10"
          iconColor="text-primary"
        />
        <StatCard
          icon="event_available"
          label="Avg Annual Leave Left"
          value={`${avgAnnualRemaining}d`}
          sub="across all staff"
          iconBg="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon="airline_seat_flat"
          label="On Leave Today"
          value={staffOnLeaveToday}
          sub={staffOnLeaveToday === 1 ? "staff member" : "staff members"}
          iconBg="bg-amber-50"
          iconColor="text-amber-600"
        />
        <StatCard
          icon="upcoming"
          label="Upcoming Leave"
          value={upcomingCount}
          sub="in the next 7 days"
          iconBg="bg-violet-50"
          iconColor="text-violet-600"
        />
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error_outline</span>
          {error}
        </div>
      )}

      {/* Filters */}
      <div className="card p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" style={{ fontSize: "20px" }}>
            search
          </span>
          <input
            type="search"
            placeholder="Search by name, email or job title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input pl-10 w-full"
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setFilterOnLeave((v) => !v)}
            className={cn("filter-tab", filterOnLeave && "active")}
          >
            <span className="material-symbols-outlined text-[14px]">airline_seat_flat</span>
            On Leave Today
          </button>
          <span className="text-xs text-neutral-400 ml-2">
            {filtered.length} staff member{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100">
          <h2 className="text-sm font-semibold text-neutral-900">Staff Leave Balances</h2>
          <p className="text-xs text-neutral-400">Based on approved leave for {new Date().getFullYear()}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="min-w-[160px]">Employee</th>
                <th className="min-w-[180px]">Annual Leave</th>
                <th className="min-w-[140px]">Sick Leave</th>
                <th className="min-w-[80px]">LIL (hrs)</th>
                <th className="min-w-[100px]">Mat / Pat</th>
                <th className="min-w-[100px]">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)
                : filtered.length === 0
                  ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-sm text-neutral-400">
                        {search || filterOnLeave ? "No staff members match the current filters." : "No staff data found."}
                      </td>
                    </tr>
                  )
                  : filtered.map((row) => {
                    const remaining = row.annualTotal - row.annualUsed;
                    const barColor = utilColorClass(row.annualUsed, row.annualTotal);

                    return (
                      <tr key={row.user.id}>
                        {/* Employee */}
                        <td>
                          <div className="flex items-center gap-2.5">
                            <div className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-full text-white text-xs font-bold flex-shrink-0",
                              avatarColor(row.user.name)
                            )}>
                              {initials(row.user.name)}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-neutral-900 truncate">{row.user.name}</p>
                              <p className="text-[11px] text-neutral-400 truncate">{row.user.job_title ?? row.user.email}</p>
                            </div>
                          </div>
                        </td>

                        {/* Annual Leave */}
                        <td>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className={cn(
                                "text-xs font-bold",
                                remaining > 10 ? "text-green-700" : remaining > 5 ? "text-amber-600" : "text-red-600"
                              )}>
                                {remaining}d left
                              </span>
                            </div>
                            <UtilBar used={row.annualUsed} total={row.annualTotal} colorClass={barColor} />
                          </div>
                        </td>

                        {/* Sick Leave */}
                        <td>
                          <UtilBar
                            used={row.sickUsed}
                            total={row.sickTotal}
                            colorClass={utilColorClass(row.sickUsed, row.sickTotal)}
                          />
                        </td>

                        {/* LIL */}
                        <td>
                          <span className={cn(
                            "text-sm font-semibold",
                            row.lilHours > 0 ? "text-blue-700" : "text-neutral-400"
                          )}>
                            {row.lilHours > 0 ? `${row.lilHours.toFixed(1)}h` : "—"}
                          </span>
                        </td>

                        {/* Mat/Pat */}
                        <td>
                          <div className="text-xs text-neutral-600 space-y-0.5">
                            {row.maternityDays > 0 && (
                              <p><span className="font-semibold text-violet-700">{row.maternityDays}d</span> mat</p>
                            )}
                            {row.paternityDays > 0 && (
                              <p><span className="font-semibold text-indigo-600">{row.paternityDays}d</span> pat</p>
                            )}
                            {row.maternityDays === 0 && row.paternityDays === 0 && (
                              <span className="text-neutral-400">—</span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <div className="flex flex-col gap-1">
                            {row.onLeaveToday && (
                              <span className="badge badge-warning inline-flex items-center gap-1 text-[10px]">
                                <span className="material-symbols-outlined text-[10px]">airline_seat_flat</span>
                                On Leave
                              </span>
                            )}
                            {row.upcomingLeave && !row.onLeaveToday && (
                              <span className="badge badge-primary inline-flex items-center gap-1 text-[10px]">
                                <span className="material-symbols-outlined text-[10px]">upcoming</span>
                                Upcoming
                              </span>
                            )}
                            {!row.onLeaveToday && !row.upcomingLeave && (
                              <span className="badge badge-success inline-flex items-center gap-1 text-[10px]">
                                <span className="material-symbols-outlined text-[10px]">check_circle</span>
                                Active
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      {!loading && (
        <div className="card p-4">
          <p className="text-xs font-semibold text-neutral-500 mb-3 uppercase tracking-wider">Utilisation Legend</p>
          <div className="flex flex-wrap gap-5 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-8 rounded-full bg-green-500" />
              <span>More than 50% remaining</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-8 rounded-full bg-amber-400" />
              <span>25–50% remaining</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-8 rounded-full bg-red-500" />
              <span>Less than 25% remaining</span>
            </div>
            <div className="flex items-center gap-2 ml-auto text-neutral-400">
              <span className="material-symbols-outlined text-[14px]">info</span>
              <span>
                {activeProfile ? `${activeProfile.profile_name} — ` : ""}
                Annual {annualEntitlement}d · Sick {sickEntitlement}d · Mat {maternityEntitlement}d · Pat {paternityEntitlement}d
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
