"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { canViewProcurementVendors, getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Approved",  cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  draft:     { label: "Draft",     cls: "badge-muted"   },
  cancelled: { label: "Cancelled", cls: "badge-muted"   },
};

const categoryColors: Record<string, string> = {
  goods:    "text-primary bg-primary/10 border-primary/20",
  services: "text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800/50",
  works:    "text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800/50",
};

const methodColors: Record<string, string> = {
  quotation: "text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20",
  tender:    "text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20",
  direct:    "text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-700/40",
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Rejected"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Rejected: "rejected",
};

export default function ProcurementPage() {
  const user = getStoredUser();
  const canCreateRequest = !!user && (isSystemAdmin(user) || hasPermission(user, ["procurement.create", "procurement.admin"]));
  const canViewVendors = canViewProcurementVendors(user);
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const { data: requests = [], isLoading: loading, isError } = useQuery({
    queryKey: ["procurement", "list", statusFilter],
    queryFn: () => {
      const status = filterMap[statusFilter];
      return procurementApi.list(status ? { status } : undefined).then((res) => (res.data as any).data as ProcurementRequest[] ?? []);
    },
    staleTime: 30_000,
  });

  const totalValue = requests.reduce((s, r) => s + r.estimated_value, 0);
  const currency = requests[0]?.currency ?? "USD";

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Procurement</h1>
          <p className="page-subtitle">Manage requisitions, vendor quotes, and procurement approvals.</p>
        </div>
        <div className="flex items-center gap-2">
          {canViewVendors && (
            <Link href="/procurement/vendors" className="btn-secondary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Vendors
            </Link>
          )}
          {canCreateRequest && (
            <Link href="/procurement/create" className="btn-primary flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Requisition
            </Link>
          )}
        </div>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load procurement requests.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total Requisitions", value: requests.length.toString(),                                       icon: "shopping_cart",  color: "text-primary",   bg: "bg-primary/10"},
          { label: "Pending Approval",   value: requests.filter((r) => r.status === "submitted").length.toString(), icon: "pending_actions",color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20"  },
          { label: "Approved",           value: requests.filter((r) => r.status === "approved").length.toString(),  icon: "check_circle",   color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20"  },
          { label: "Total Value",        value: totalValue > 0 ? `${currency} ${(totalValue / 1000).toFixed(0)}k` : "—", icon: "payments", color: "text-purple-600",bg: "bg-purple-50 dark:bg-purple-900/20" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
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
          <div className="flex items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : requests.length > 0 ? (
        <div className="space-y-3">
          {requests.map((req) => {
            const s = statusConfig[req.status] ?? { label: req.status, cls: "badge-muted" };
            const catColor = categoryColors[req.category] ?? "text-neutral-700 bg-neutral-50 border-neutral-200";
            const methodColor = methodColors[req.procurement_method] ?? "text-neutral-600 bg-neutral-50";
            return (
              <Link
                key={req.id}
                href={`/procurement/${req.id}`}
                className="card block p-5 hover:border-primary/30 hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-purple-50 dark:bg-purple-900/20">
                      <span className="material-symbols-outlined text-purple-600 dark:text-purple-400 text-[20px]">shopping_cart</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">{req.reference_number}</span>
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${catColor}`}>
                          {req.category}
                        </span>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{req.title}</p>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className={`rounded-full px-2 py-0.5 font-medium ${methodColor}`}>
                          {req.procurement_method}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          Required by {formatDateShort(req.required_by_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Est. Value</p>
                    <p className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {req.currency} {req.estimated_value.toLocaleString()}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="card p-16 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 dark:bg-neutral-700/40 mx-auto">
            <span className="material-symbols-outlined text-4xl text-neutral-300 dark:text-neutral-500">shopping_cart</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400">No procurement requests found</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {statusFilter === "All" ? "Create a requisition to get started." : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
          {canCreateRequest && (
            <Link href="/procurement/create" className="btn-primary mt-5 inline-flex">
              <span className="material-symbols-outlined text-[18px]">add</span>
              New Requisition
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
