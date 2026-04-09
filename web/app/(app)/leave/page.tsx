"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { leaveApi, type LeaveRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
  annual:    { label: "Annual Leave",    color: "text-primary",   bg: "bg-primary/10"  },
  sick:      { label: "Sick Leave",      color: "text-red-600",   bg: "bg-red-50"      },
  lil:       { label: "Leave in Lieu",   color: "text-purple-600",bg: "bg-purple-50"   },
  special:   { label: "Special Leave",   color: "text-orange-600",bg: "bg-orange-50"   },
  maternity: { label: "Maternity Leave", color: "text-pink-600",  bg: "bg-pink-50"     },
  paternity: { label: "Paternity Leave", color: "text-teal-600",  bg: "bg-teal-50"     },
};

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Approved",  cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  draft:     { label: "Draft",     cls: "badge-muted"   },
  cancelled: { label: "Cancelled", cls: "badge-muted"   },
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Rejected"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Rejected: "rejected",
};

interface Balances {
  annual_balance_days: number;
  lil_hours_available: number;
  sick_leave_used_days: number;
  special_leave_days_used: number;
  maternity_leave_days_used: number;
  paternity_leave_days_used: number;
}

export default function LeavePage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const { data: requests = [], isLoading: loading, isError } = useQuery({
    queryKey: ["leave", "list", statusFilter],
    queryFn: () => {
      const status = filterMap[statusFilter];
      return leaveApi.list(status ? { status } : undefined).then((res) => (res.data as any).data as LeaveRequest[]);
    },
    staleTime: 30_000,
  });

  const { data: balances = null } = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: () => leaveApi.getBalances().then((res) => res.data as Balances),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="page-subtitle">Manage your leave applications and LIL linkings.</p>
        </div>
        <Link href="/leave/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Request
        </Link>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load leave requests.
        </div>
      )}

      {/* Balance cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "Annual Leave",   sub: "days remaining",   value: balances ? `${balances.annual_balance_days}` : "—",           icon: "event_available",  color: "text-green-600",  bg: "bg-green-50"  },
          { label: "Leave in Lieu",  sub: "hours available",  value: balances ? `${balances.lil_hours_available}` : "—",           icon: "schedule",         color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Sick Leave",     sub: "days used",        value: balances ? `${balances.sick_leave_used_days}` : "—",          icon: "sick",             color: "text-red-600",    bg: "bg-red-50"    },
          { label: "Special Leave",  sub: "days used",        value: balances ? `${balances.special_leave_days_used}` : "—",       icon: "star",             color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Maternity Leave",sub: "days used",        value: balances ? `${balances.maternity_leave_days_used}` : "—",     icon: "pregnant_woman",   color: "text-pink-600",   bg: "bg-pink-50"   },
          { label: "Paternity Leave",sub: "days used",        value: balances ? `${balances.paternity_leave_days_used}` : "—",     icon: "man",              color: "text-teal-600",   bg: "bg-teal-50"   },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-700">{stat.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-1">{stat.value}</p>
                <p className="text-[11px] text-neutral-400 mt-0.5">{stat.sub}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
                <span className={`material-symbols-outlined ${stat.color} text-[20px]`}>{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`filter-tab ${statusFilter === f ? "active" : ""}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((req) => {
            const s = statusConfig[req.status] ?? { label: req.status, cls: "badge-muted" };
            const t = typeConfig[req.leave_type] ?? { label: req.leave_type, color: "text-neutral-600", bg: "bg-neutral-100" };
            return (
              <div key={req.id} className="card p-5 hover:shadow-elevated transition-shadow">
                <div className="flex items-start gap-4">
                  <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${t.bg}`}>
                    <span className={`material-symbols-outlined ${t.color} text-[20px]`}>event_available</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-xs font-mono text-neutral-400">{req.reference_number}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${t.bg} ${t.color}`}>
                        {t.label}
                      </span>
                      <span className={`badge ${s.cls}`}>{s.label}</span>
                    </div>
                    <p className="text-sm font-semibold text-neutral-900">{req.reason || "No reason provided"}</p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-neutral-500">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {formatDateShort(req.start_date)} → {formatDateShort(req.end_date)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_month</span>
                        {req.days_requested} day{req.days_requested !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-3 pt-3 border-t border-neutral-50">
                  {req.status === "draft" && (
                    <Link href={`/leave/create?edit=${req.id}`} className="text-xs font-semibold text-primary hover:underline">Edit</Link>
                  )}
                  <Link href={`/leave/${req.id}`} className="text-xs font-medium text-neutral-500 hover:text-neutral-700">View Details →</Link>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 mx-auto">
            <span className="material-symbols-outlined text-4xl text-neutral-300">event_available</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600">No leave requests found</p>
          <p className="text-xs text-neutral-400 mt-1">
            {statusFilter === "All" ? "Submit your first leave application." : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
          <Link href="/leave/create" className="btn-primary mt-5 inline-flex">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Apply for Leave
          </Link>
        </div>
      )}
    </div>
  );
}
