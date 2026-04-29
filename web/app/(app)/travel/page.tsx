"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

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

export default function TravelPage() {
  const [statusFilter, setStatusFilter] = useState<string>("All");

  const { data: requests = [], isLoading: loading, isError } = useQuery({
    queryKey: ["travel", "list", statusFilter],
    queryFn: () => {
      const status = filterMap[statusFilter];
      return travelApi.list(status ? { status } : undefined).then((res) => (res.data as any).data as TravelRequest[]);
    },
    staleTime: 30_000,
  });

  const destination = (r: TravelRequest) =>
    [r.destination_city, r.destination_country].filter(Boolean).join(", ") || r.destination_country;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">Travel Requests</h1>
          <p className="page-subtitle">Manage your travel requisitions and DSA claims.</p>
        </div>
        <Link href="/travel/create" className="btn-primary">
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Request
        </Link>
      </div>

      {isError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load travel requests.
        </div>
      )}

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
            return (
              <Link
                key={req.id}
                href={`/travel/${req.id}`}
                className="card block p-5 hover:border-primary/30 hover:shadow-elevated transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <span className="material-symbols-outlined text-primary text-[20px]">flight_takeoff</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs font-mono text-neutral-400 dark:text-neutral-500">{req.reference_number}</span>
                        <span className={`badge ${s.cls}`}>{s.label}</span>
                      </div>
                      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{req.purpose}</p>
                      <div className="flex flex-wrap items-center gap-4 mt-2 text-xs text-neutral-500 dark:text-neutral-400">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">location_on</span>
                          {destination(req)}
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                          {formatDateShort(req.departure_date)} → {formatDateShort(req.return_date)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[10px] text-neutral-400 dark:text-neutral-500 uppercase tracking-wide">Est. DSA</p>
                    <p className="text-base font-bold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {req.currency} {req.estimated_dsa.toLocaleString()}
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
            <span className="material-symbols-outlined text-4xl text-neutral-300 dark:text-neutral-500">flight_takeoff</span>
          </div>
          <p className="mt-4 text-sm font-semibold text-neutral-600 dark:text-neutral-400">No travel requests found</p>
          <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
            {statusFilter === "All" ? "Create your first travel request to get started." : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
          <Link href="/travel/create" className="btn-primary mt-5 inline-flex">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Travel Request
          </Link>
        </div>
      )}
    </div>
  );
}
