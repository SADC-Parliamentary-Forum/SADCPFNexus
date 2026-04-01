"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { contractsApi, type Contract } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const statusConfig: Record<string, { label: string; cls: string; icon: string }> = {
  draft:      { label: "Draft",      cls: "badge-muted",   icon: "edit_note"    },
  active:     { label: "Active",     cls: "badge-success", icon: "check_circle" },
  completed:  { label: "Completed",  cls: "badge-primary", icon: "task_alt"     },
  terminated: { label: "Terminated", cls: "badge-danger",  icon: "cancel"       },
};

const FILTERS = ["all", "draft", "active", "completed", "terminated"];

export default function ContractsPage() {
  const [statusFilter, setStatusFilter] = useState("all");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["contracts", statusFilter],
    queryFn: () =>
      contractsApi.list(statusFilter !== "all" ? { status: statusFilter } : undefined)
        .then((r) => r.data),
  });

  const items: Contract[] = (data as { data?: Contract[] })?.data ?? [];
  const total      = items.length;
  const active     = items.filter((c) => c.status === "active" && !c.is_expired).length;
  const expiringSoon = items.filter((c) => c.is_expiring_soon).length;
  const expired    = items.filter((c) => c.is_expired).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Contracts</h1>
          <p className="page-subtitle">Manage vendor contracts and agreements</p>
        </div>
        <Link href="/procurement" className="btn-secondary inline-flex items-center gap-1.5 text-sm">
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Procurement
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Total",         value: total,        icon: "description",  color: "text-primary",   bg: "bg-primary/10"  },
          { label: "Active",        value: active,       icon: "check_circle", color: "text-green-600", bg: "bg-green-50"    },
          { label: "Expiring Soon", value: expiringSoon, icon: "schedule",     color: "text-amber-600", bg: "bg-amber-50"    },
          { label: "Expired",       value: expired,      icon: "event_busy",   color: "text-red-600",   bg: "bg-red-50"      },
        ].map((k) => (
          <div key={k.label} className="card p-4 flex items-center gap-3">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.bg} flex-shrink-0`}>
              <span className={`material-symbols-outlined text-[22px] ${k.color}`}>{k.icon}</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-neutral-900">{k.value}</p>
              <p className="text-xs text-neutral-500">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
              <div className="h-10 w-10 rounded-xl bg-neutral-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-neutral-100 rounded" />
                <div className="h-4 w-56 bg-neutral-100 rounded" />
              </div>
              <div className="h-6 w-20 bg-neutral-100 rounded-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="card p-6 text-center text-sm text-red-600">Failed to load contracts.</div>
      ) : items.length === 0 ? (
        <div className="card p-12 text-center space-y-3">
          <span className="material-symbols-outlined text-4xl text-neutral-300">description</span>
          <p className="text-sm text-neutral-500">No contracts found.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contract Reference</th>
                <th>Title</th>
                <th>Vendor</th>
                <th className="text-right">Value</th>
                <th>End Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((c) => {
                const s = statusConfig[c.status] ?? statusConfig.draft;
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/procurement/contracts/${c.id}`} className="font-mono text-xs text-primary hover:underline">
                        {c.reference_number}
                      </Link>
                    </td>
                    <td className="text-sm font-medium text-neutral-800 max-w-[200px] truncate">{c.title}</td>
                    <td className="text-sm text-neutral-600">{c.vendor?.name ?? "—"}</td>
                    <td className="text-right font-semibold text-neutral-900 text-sm">
                      {c.currency} {Number(c.value).toLocaleString()}
                    </td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm text-neutral-500">
                          {c.end_date ? formatDateShort(c.end_date) : "—"}
                        </span>
                        {c.is_expired && (
                          <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full">Expired</span>
                        )}
                        {!c.is_expired && c.is_expiring_soon && (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">Soon</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${s.cls} inline-flex items-center gap-1`}>
                        <span className="material-symbols-outlined text-[11px]">{s.icon}</span>
                        {s.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
