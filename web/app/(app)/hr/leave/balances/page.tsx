"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  leaveApi,
  tenantUsersApi,
  hrSettingsApi,
  hrLeaveBalancesApi,
  type LeaveRequest,
  type TenantUserOption,
  type AdminLeaveBalanceRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ─── Initialize Year Modal ────────────────────────────────────────────────────

function InitializeModal({
  year,
  onClose,
  onSuccess,
}: {
  year: number;
  onClose: () => void;
  onSuccess: (created: number, skipped: number) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hrLeaveBalancesApi.initializeYear(year);
      onSuccess(res.data.created, res.data.skipped);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Initialization failed. Please try again.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0">
            <span className="material-symbols-outlined text-primary">event_available</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-neutral-900">Initialize {year} Leave Balances</h2>
            <p className="text-sm text-neutral-500 mt-1">
              This will create opening leave balance records for all employees who do not yet have one for {year},
              using their grade band&apos;s leave profile defaults (21 days if no profile is configured).
              Employees who already have records will be skipped.
            </p>
          </div>
        </div>
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">{error}</div>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} disabled={loading} className="btn-secondary text-sm">Cancel</button>
          <button onClick={handleConfirm} disabled={loading}
            className="btn-primary text-sm flex items-center gap-2 disabled:opacity-50">
            {loading ? (
              <><span className="material-symbols-outlined text-base animate-spin">progress_activity</span>Initializing…</>
            ) : (
              <><span className="material-symbols-outlined text-base">bolt</span>Initialize {year}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffLeaveRow {
  user: TenantUserOption;
  annualUsed: number;
  annualTotal: number;
  lilHoursAvailable: number;
  sickUsed: number;
  sickTotal: number;
  lilHours: number;
  maternityDays: number;
  paternityDays: number;
  onLeaveToday: boolean;
  upcomingLeave: boolean;
  hasBalanceRecord: boolean;
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

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = [CURRENT_YEAR + 1, CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaveBalancesPage() {
  const [users, setUsers] = useState<TenantUserOption[]>([]);
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [adminBalances, setAdminBalances] = useState<AdminLeaveBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [filterOnLeave, setFilterOnLeave] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number>(CURRENT_YEAR);

  // Inline-edit state per user
  const [editDraft, setEditDraft] = useState<Record<number, { days: string; lil: string }>>({});
  const [saving, setSaving] = useState<Record<number, boolean>>({});
  const [saveErrors, setSaveErrors] = useState<Record<number, string>>({});

  // Initialize year modal
  const [showInitModal, setShowInitModal] = useState(false);
  const [initResult, setInitResult] = useState<{ created: number; skipped: number } | null>(null);

  const { data: profilesData } = useQuery({
    queryKey: ["hr-settings", "leave-profiles"],
    queryFn: () => hrSettingsApi.listLeaveProfiles().then((r) => r.data.data),
  });

  const activeProfile = (profilesData ?? []).find((p) => p.is_active) ?? null;
  const annualEntitlement    = activeProfile?.annual_leave_days  ?? 21;
  const sickEntitlement      = activeProfile?.sick_leave_days    ?? 30;
  const maternityEntitlement = activeProfile?.maternity_days     ?? 90;
  const paternityEntitlement = activeProfile?.paternity_days     ?? 10;

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [usersRes, leaveRes, balancesRes] = await Promise.all([
          tenantUsersApi.list(),
          leaveApi.list({ per_page: 500, status: "approved" }),
          hrLeaveBalancesApi.listAll(selectedYear),
        ]);
        const usersData: TenantUserOption[] =
          (usersRes.data as { data?: TenantUserOption[] }).data ??
          (Array.isArray(usersRes.data) ? (usersRes.data as unknown as TenantUserOption[]) : []);
        setUsers(usersData);
        setRequests(leaveRes.data.data ?? []);
        setAdminBalances(balancesRes.data.data ?? []);
        // Clear edit drafts when year changes
        setEditDraft({});
        setSaveErrors({});
      } catch {
        setError("Failed to load leave data. You may need HR administrator permissions.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [selectedYear]);

  // Build lookup map for admin balances
  const balanceByUser = useMemo(
    () => Object.fromEntries(adminBalances.map((b) => [b.user_id, b])),
    [adminBalances]
  );

  // Build per-staff balance rows
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

      const onLeaveToday = userReqs.some((r) => {
        const start = parseDate(r.start_date);
        const end = parseDate(r.end_date);
        return TODAY >= start && TODAY <= end;
      });

      const upcomingLeave = userReqs.some((r) => {
        const start = parseDate(r.start_date);
        return start > TODAY && start <= NEXT_7;
      });

      // Use stored opening balance if available, otherwise fall back to profile entitlement
      const bal = balanceByUser[user.id];
      const annualTotal = bal ? bal.annual_balance_days : annualEntitlement;
      const lilHoursAvailable = bal ? bal.lil_hours_available : 0;

      return {
        user,
        annualUsed,
        annualTotal,
        lilHoursAvailable,
        sickUsed,
        sickTotal: sickEntitlement,
        lilHours,
        maternityDays,
        paternityDays,
        onLeaveToday,
        upcomingLeave,
        hasBalanceRecord: !!bal,
      };
    });
  }, [users, requests, balanceByUser, annualEntitlement, sickEntitlement]);

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

  // Handle save of a single employee's opening balance
  const handleSave = async (userId: number) => {
    const draft = editDraft[userId];
    if (!draft) return;

    setSaving((s) => ({ ...s, [userId]: true }));
    setSaveErrors((e) => { const n = { ...e }; delete n[userId]; return n; });

    try {
      await hrLeaveBalancesApi.upsert({
        user_id: userId,
        period_year: selectedYear,
        annual_balance_days: Math.max(0, parseInt(draft.days, 10) || 0),
        lil_hours_available: Math.max(0, parseFloat(draft.lil) || 0),
      });
      // Refresh balances only (not the full page reload)
      const res = await hrLeaveBalancesApi.listAll(selectedYear);
      setAdminBalances(res.data.data ?? []);
      setEditDraft((d) => { const n = { ...d }; delete n[userId]; return n; });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Save failed. Please try again.";
      setSaveErrors((e) => ({ ...e, [userId]: msg }));
    } finally {
      setSaving((s) => ({ ...s, [userId]: false }));
    }
  };

  const startEdit = (row: StaffLeaveRow) => {
    setEditDraft((d) => ({
      ...d,
      [row.user.id]: {
        days: String(row.annualTotal),
        lil: String(row.lilHoursAvailable),
      },
    }));
  };

  const cancelEdit = (userId: number) => {
    setEditDraft((d) => { const n = { ...d }; delete n[userId]; return n; });
    setSaveErrors((e) => { const n = { ...e }; delete n[userId]; return n; });
  };

  return (
    <div className="space-y-6">

      {showInitModal && (
        <InitializeModal
          year={selectedYear}
          onClose={() => setShowInitModal(false)}
          onSuccess={async (created, skipped) => {
            setShowInitModal(false);
            setInitResult({ created, skipped });
            // Refresh balances
            const res = await hrLeaveBalancesApi.listAll(selectedYear);
            setAdminBalances(res.data.data ?? []);
          }}
        />
      )}

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
            Opening balances are editable per employee.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="form-input py-2 px-3 text-sm"
            aria-label="Select year"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { setInitResult(null); setShowInitModal(true); }}
            className="btn-primary py-2 px-3 text-sm flex items-center gap-1.5"
            title={`Initialize ${selectedYear} leave balances from profile defaults`}
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Initialize {selectedYear}
          </button>
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

      {initResult && (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">check_circle</span>
            <span>
              Initialized <strong>{initResult.created}</strong> balance record{initResult.created !== 1 ? "s" : ""} for {selectedYear}.
              {initResult.skipped > 0 && <> <strong>{initResult.skipped}</strong> already had records and were skipped.</>}
            </span>
          </div>
          <button onClick={() => setInitResult(null)} className="text-green-500 hover:text-green-700">
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

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
          <h2 className="text-sm font-semibold text-neutral-900">Staff Leave Balances — {selectedYear}</h2>
          <p className="text-xs text-neutral-400">
            Opening balance is editable · Used days derived from approved leave requests
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="min-w-[160px]">Employee</th>
                <th className="min-w-[200px]">Annual Leave (Opening / Used)</th>
                <th className="min-w-[140px]">Sick Leave</th>
                <th className="min-w-[100px]">LIL Used / Avail</th>
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
                    const isEditing = !!editDraft[row.user.id];
                    const isSaving = !!saving[row.user.id];
                    const saveError = saveErrors[row.user.id];

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

                        {/* Annual Leave — opening/used with inline edit */}
                        <td>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2">
                              {isEditing ? (
                                <>
                                  <input
                                    type="number"
                                    min={0}
                                    max={365}
                                    value={editDraft[row.user.id].days}
                                    onChange={(e) =>
                                      setEditDraft((d) => ({
                                        ...d,
                                        [row.user.id]: { ...d[row.user.id], days: e.target.value },
                                      }))
                                    }
                                    className="form-input w-16 py-0.5 text-sm"
                                    aria-label="Opening annual balance days"
                                  />
                                  <span className="text-xs text-neutral-400">d opening</span>
                                  <button
                                    type="button"
                                    onClick={() => handleSave(row.user.id)}
                                    disabled={isSaving}
                                    className="btn-primary py-0.5 px-2 text-xs"
                                  >
                                    {isSaving ? "…" : "Save"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => cancelEdit(row.user.id)}
                                    disabled={isSaving}
                                    className="text-neutral-400 hover:text-neutral-700 transition-colors"
                                    aria-label="Cancel edit"
                                  >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className={cn(
                                    "text-xs font-bold",
                                    remaining > 10 ? "text-green-700" : remaining > 5 ? "text-amber-600" : "text-red-600"
                                  )}>
                                    {remaining}d left
                                  </span>
                                  {!row.hasBalanceRecord && (
                                    <span className="text-[10px] text-neutral-400 bg-neutral-100 rounded px-1 py-0.5">
                                      profile default
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => startEdit(row)}
                                    className="text-neutral-300 hover:text-primary transition-colors ml-auto"
                                    title="Edit opening balance"
                                    aria-label="Edit opening balance"
                                  >
                                    <span className="material-symbols-outlined text-[15px]">edit</span>
                                  </button>
                                </>
                              )}
                            </div>
                            <UtilBar used={row.annualUsed} total={row.annualTotal} colorClass={barColor} />
                            {saveError && (
                              <p className="text-[10px] text-red-600">{saveError}</p>
                            )}
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

                        {/* LIL used / available */}
                        <td>
                          <div className="space-y-1">
                            <span className={cn(
                              "text-sm font-semibold",
                              row.lilHours > 0 ? "text-blue-700" : "text-neutral-400"
                            )}>
                              {row.lilHours > 0 ? `${row.lilHours.toFixed(1)}h used` : "—"}
                            </span>
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number"
                                  min={0}
                                  step={0.5}
                                  value={editDraft[row.user.id].lil}
                                  onChange={(e) =>
                                    setEditDraft((d) => ({
                                      ...d,
                                      [row.user.id]: { ...d[row.user.id], lil: e.target.value },
                                    }))
                                  }
                                  className="form-input w-20 py-0.5 text-xs"
                                  placeholder="avail hrs"
                                  aria-label="LIL hours available"
                                />
                                <span className="text-[10px] text-neutral-400">avail</span>
                              </div>
                            ) : (
                              row.lilHoursAvailable > 0 && (
                                <p className="text-[10px] text-blue-600">{row.lilHoursAvailable.toFixed(1)}h avail</p>
                              )
                            )}
                          </div>
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
                Opening balance is HR-editable per employee · Remaining = Opening − Used ·
                Sick {sickEntitlement}d · Mat {maternityEntitlement}d · Pat {paternityEntitlement}d
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
