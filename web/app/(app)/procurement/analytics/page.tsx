"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { procurementAnalyticsApi, type ProcurementFlag } from "@/lib/api";

const flagSeverityConfig: Record<string, { cls: string; bg: string; icon: string }> = {
  critical: { cls: "text-red-700",    bg: "bg-red-50 border-red-200",    icon: "error"         },
  high:     { cls: "text-amber-700",  bg: "bg-amber-50 border-amber-200",icon: "warning"       },
  medium:   { cls: "text-blue-700",   bg: "bg-blue-50 border-blue-200",  icon: "info"          },
  low:      { cls: "text-neutral-600",bg: "bg-neutral-50 border-neutral-200",icon: "flag"      },
};

export default function ProcurementAnalyticsPage() {
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["procurement-analytics-summary"],
    queryFn:  () => procurementAnalyticsApi.summary().then((r) => r.data.data),
  });

  const { data: categoryData } = useQuery({
    queryKey: ["procurement-analytics-category"],
    queryFn:  () => procurementAnalyticsApi.spendByCategory().then((r) => r.data.data),
  });

  const { data: vendorData } = useQuery({
    queryKey: ["procurement-analytics-vendors"],
    queryFn:  () => procurementAnalyticsApi.vendorPerformance().then((r) => r.data.data),
  });

  const { data: flagsData } = useQuery({
    queryKey: ["procurement-analytics-flags"],
    queryFn:  () => procurementAnalyticsApi.flags().then((r) => r.data.data),
  });

  const summary      = summaryData;
  const categories   = categoryData ?? [];
  const vendors      = (vendorData ?? []).slice(0, 5);
  const flags        = (flagsData ?? []) as ProcurementFlag[];

  const categoryMax  = Math.max(...categories.map((c) => c.total), 1);
  const vendorMax    = Math.max(...vendors.map((v) => v.total_value), 1);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Procurement Analytics</h1>
          <p className="page-subtitle">Spend intelligence, vendor performance, and compliance flags</p>
        </div>
        <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Procurement
        </Link>
      </div>

      {/* KPI strip */}
      {summaryLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse h-20" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { label: "Total Requests",    value: summary?.total_requests ?? 0,            icon: "assignment",     color: "text-primary",   bg: "bg-primary/10",  fmt: (v: number) => v.toString()   },
            { label: "Total Spend (NAD)", value: summary?.total_spend ?? 0,               icon: "payments",       color: "text-green-600", bg: "bg-green-50",    fmt: (v: number) => `${(v/1000).toFixed(0)}k` },
            { label: "Avg Cycle (days)",  value: summary?.avg_cycle_time_days ?? 0,        icon: "schedule",       color: "text-blue-600",  bg: "bg-blue-50",     fmt: (v: number) => v.toString()   },
            { label: "Active Contracts",  value: summary?.active_contracts ?? 0,           icon: "description",   color: "text-amber-600", bg: "bg-amber-50",    fmt: (v: number) => v.toString()   },
          ].map((k) => (
            <div key={k.label} className="card p-4 flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
                <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
              </div>
              <div>
                <p className="text-2xl font-bold text-neutral-900">{k.fmt(k.value)}</p>
                <p className="text-xs text-neutral-500">{k.label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Spend by Category */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">bar_chart</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Spend by Category</h3>
          </div>
          {categories.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-6">No spend data available.</p>
          ) : (
            <div className="space-y-3">
              {categories.map((c) => (
                <div key={c.category}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-700 capitalize">{c.category}</span>
                    <span className="text-xs text-neutral-500">NAD {(c.total / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.max((c.total / categoryMax) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Vendors by Value */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="material-symbols-outlined text-[18px] text-neutral-400">storefront</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Top Vendors by Spend</h3>
          </div>
          {vendors.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-6">No vendor data available.</p>
          ) : (
            <div className="space-y-3">
              {vendors.map((v) => (
                <div key={v.vendor_id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-neutral-700 truncate max-w-[180px]">{v.vendor_name}</span>
                    <span className="text-xs text-neutral-500">{v.po_count} PO{v.po_count !== 1 ? "s" : ""} · NAD {(v.total_value / 1000).toFixed(0)}k</span>
                  </div>
                  <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.max((v.total_value / vendorMax) * 100, 2)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Anti-Corruption Flags */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className={`material-symbols-outlined text-[18px] ${flags.length > 0 ? "text-amber-500" : "text-neutral-400"}`}>shield</span>
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-500">Anti-Corruption Flags</h3>
          </div>
          {flags.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              {flags.length} flag{flags.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {flags.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg bg-green-50 border border-green-200 p-4">
            <span className="material-symbols-outlined text-[22px] text-green-600">verified_user</span>
            <div>
              <p className="text-sm font-medium text-green-800">No flags detected</p>
              <p className="text-xs text-green-600">All procurement activity appears within normal parameters.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {flags.map((flag, i) => {
              const fc = flagSeverityConfig[flag.severity] ?? flagSeverityConfig.low;
              return (
                <div key={i} className={`flex items-start gap-3 rounded-lg border p-3 ${fc.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0 ${fc.cls}`}>{fc.icon}</span>
                  <div>
                    <p className={`text-xs font-semibold uppercase tracking-wide mb-0.5 ${fc.cls}`}>
                      {flag.severity} · {flag.type.replace(/_/g, " ")}
                    </p>
                    <p className="text-sm text-neutral-700">{flag.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
