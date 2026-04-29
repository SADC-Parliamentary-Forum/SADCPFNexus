"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { dashboardApi, type DashboardStats } from "@/lib/api";
import { getStoredUser } from "@/lib/auth";

const KPI_CARDS: {
  key: keyof DashboardStats;
  label: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  href: string;
}[] = [
  { key: "pending_approvals",  label: "Pending Approvals",  icon: "approval",              iconBg: "bg-amber-100 dark:bg-amber-900/20",   iconColor: "text-amber-600 dark:text-amber-300",  href: "/approvals" },
  { key: "active_travels",     label: "Active Travel",      icon: "flight_takeoff",         iconBg: "bg-blue-100 dark:bg-blue-900/20",     iconColor: "text-blue-600 dark:text-blue-300",    href: "/travel" },
  { key: "leave_requests",     label: "Leave Requests",     icon: "event_available",        iconBg: "bg-green-100 dark:bg-green-900/20",   iconColor: "text-green-600 dark:text-green-300",  href: "/leave" },
  { key: "open_requisitions",  label: "Open Requisitions",  icon: "shopping_cart",          iconBg: "bg-purple-100 dark:bg-purple-900/20", iconColor: "text-purple-600 dark:text-purple-300", href: "/procurement" },
];

const QUICK_ACTIONS = [
  { label: "New Travel Request",     icon: "flight_takeoff",        href: "/travel/create",        color: "text-blue-600 dark:text-blue-300",    bg: "bg-blue-50 dark:bg-blue-900/20"     },
  { label: "Apply for Leave",        icon: "event_available",       href: "/leave/create",         color: "text-green-600 dark:text-green-300",  bg: "bg-green-50 dark:bg-green-900/20"   },
  { label: "Submit Imprest",         icon: "account_balance_wallet", href: "/imprest/create",      color: "text-amber-600 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-900/20"   },
  { label: "New Procurement",        icon: "shopping_cart",         href: "/procurement/create",   color: "text-purple-600 dark:text-purple-300",bg: "bg-purple-50 dark:bg-purple-900/20" },
  { label: "Salary Advance",         icon: "payments",              href: "/finance/salary-advance/create", color: "text-rose-600 dark:text-rose-300", bg: "bg-rose-50 dark:bg-rose-900/20" },
  { label: "View Reports",           icon: "bar_chart",             href: "/reports",              color: "text-teal-600 dark:text-teal-300",    bg: "bg-teal-50 dark:bg-teal-900/20"     },
];

const MODULE_LINKS = [
  { label: "Travel",      icon: "flight_takeoff",        href: "/travel",      color: "text-blue-600 dark:text-blue-300",    bg: "bg-blue-50 dark:bg-blue-900/20"     },
  { label: "Leave",       icon: "event_available",       href: "/leave",       color: "text-green-600 dark:text-green-300",  bg: "bg-green-50 dark:bg-green-900/20"   },
  { label: "Imprest",     icon: "account_balance_wallet", href: "/imprest",    color: "text-amber-600 dark:text-amber-300",  bg: "bg-amber-50 dark:bg-amber-900/20"   },
  { label: "Procurement", icon: "shopping_cart",         href: "/procurement", color: "text-purple-600 dark:text-purple-300",bg: "bg-purple-50 dark:bg-purple-900/20" },
  { label: "Finance",     icon: "account_balance",       href: "/finance",     color: "text-sky-600 dark:text-sky-300",      bg: "bg-sky-50 dark:bg-sky-900/20"       },
  { label: "HR",          icon: "people",                href: "/hr",          color: "text-rose-600 dark:text-rose-300",    bg: "bg-rose-50 dark:bg-rose-900/20"     },
  { label: "Governance",  icon: "gavel",                 href: "/governance",  color: "text-indigo-600 dark:text-indigo-300",bg: "bg-indigo-50 dark:bg-indigo-900/20" },
  { label: "Analytics",   icon: "bar_chart",             href: "/analytics",   color: "text-teal-600 dark:text-teal-300",    bg: "bg-teal-50 dark:bg-teal-900/20"     },
  { label: "Workplan",    icon: "calendar_month",        href: "/workplan",    color: "text-orange-600 dark:text-orange-300",bg: "bg-orange-50 dark:bg-orange-900/20" },
];

export default function DashboardPage() {
  const user = getStoredUser();

  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ["dashboard", "stats"],
    queryFn: () => dashboardApi.getStats().then((res) => res.data as DashboardStats),
    staleTime: 60_000,
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome banner */}
      <div className="rounded-2xl bg-primary/10 dark:bg-primary/5 border border-primary/20 dark:border-primary/10 px-6 py-5 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
            {greeting}{user?.name ? `, ${user.name.split(" ")[0]}` : ""} 👋
          </h1>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
            Welcome to SADCPFNexus. Here&apos;s your operational overview.
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
          <Link href="/approvals" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[16px]">approval</span>
            Pending Approvals
          </Link>
        </div>
      </div>

      {/* KPI cards */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
          Overview
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {KPI_CARDS.map((kpi) => (
            <Link
              key={kpi.key}
              href={kpi.href}
              className="card p-5 hover:border-primary/30 hover:shadow-elevated transition-all block"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{kpi.label}</p>
                  {loadingStats ? (
                    <div className="h-8 w-12 bg-neutral-100 dark:bg-neutral-700/40 rounded animate-pulse mt-1" />
                  ) : (
                    <p className="text-3xl font-bold text-neutral-900 dark:text-neutral-100 mt-1">
                      {stats?.[kpi.key] ?? "—"}
                    </p>
                  )}
                </div>
                <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${kpi.iconBg}`}>
                  <span className={`material-symbols-outlined text-[20px] ${kpi.iconColor}`}>{kpi.icon}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="card p-4 flex flex-col items-center gap-2 text-center hover:border-primary/30 hover:shadow-elevated transition-all"
            >
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${action.color}`}>{action.icon}</span>
              </div>
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 leading-tight">{action.label}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* Module grid */}
      <div>
        <h2 className="text-sm font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-3">
          Modules
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-9 gap-3">
          {MODULE_LINKS.map((mod) => (
            <Link
              key={mod.label}
              href={mod.href}
              className="card p-3 flex flex-col items-center gap-1.5 text-center hover:border-primary/30 hover:shadow-elevated transition-all"
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${mod.bg}`}>
                <span className={`material-symbols-outlined text-[18px] ${mod.color}`}>{mod.icon}</span>
              </div>
              <span className="text-[11px] font-semibold text-neutral-600 dark:text-neutral-400">{mod.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
