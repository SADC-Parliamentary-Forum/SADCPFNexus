"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
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

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="rounded-xl border border-neutral-200 bg-white px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="text-2xl font-semibold text-neutral-900 mt-1">{value}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function TravelPageInner() {
  const searchParams = useSearchParams();
  const scope = searchParams.get("scope") || undefined;
  const view = searchParams.get("view") || undefined;
  const [statusFilter, setStatusFilter] = useState<string>(
    view === "approved" || view === "upcoming" || view === "away" ? "Approved" : "All"
  );

  const { data: dash } = useQuery({
    queryKey: ["travel", "dashboard", "traveller"],
    queryFn: () => travelApi.dashboardTraveller().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const listParams = useMemo(() => {
    const params: Record<string, string> = {};
    const status = filterMap[statusFilter];
    if (status) params.status = status;
    if (scope === "mine") params.scope = "mine";
    return params;
  }, [statusFilter, scope]);

  const { data: requests = [], isLoading: loading, isError } = useQuery({
    queryKey: ["travel", "list", listParams, view],
    queryFn: () => travelApi.list(listParams).then((res) => (res.data as any).data as TravelRequest[]),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (view === "upcoming") {
      return requests.filter((r) => r.status === "approved" && r.departure_date > today);
    }
    if (view === "away") {
      return requests.filter((r) => r.status === "approved" && r.departure_date <= today && r.return_date >= today);
    }
    if (view === "approved") {
      return requests.filter((r) => r.status === "approved");
    }
    return requests;
  }, [requests, view]);

  const destination = (r: TravelRequest) =>
    [r.destination_city, r.destination_country].filter(Boolean).join(", ") || r.destination_country;

  const title = view === "upcoming" ? "Upcoming Travel"
    : view === "away" ? "Travellers Away"
    : view === "approved" ? "Approved Travel"
    : scope === "mine" ? "My Travel Requests"
    : "Travel Dashboard";

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">Manage travel requisitions, readiness, and retirement.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/travel/calendar" className="btn-secondary">
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Calendar
          </Link>
          <Link href="/travel/create" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Request
          </Link>
        </div>
      </div>

      {dash && !view && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="travel-traveller-dashboard">
          <StatCard label="Drafts" value={dash.drafts ?? 0} href="/travel?scope=mine" />
          <StatCard label="Pending" value={dash.pending_approvals ?? 0} href="/travel?scope=mine" />
          <StatCard label="Upcoming" value={dash.upcoming ?? 0} href="/travel?view=upcoming" />
          <StatCard label="Current trip" value={dash.current_trip ?? 0} href="/travel?view=away" />
          <StatCard label="Retirement due" value={dash.retirement_due ?? 0} href="/travel/queues/retirement" />
          <StatCard label="TOIL pending" value={dash.toil_pending ?? 0} href="/travel/toil" />
          <StatCard label="Historical" value={dash.historical ?? 0} href="/travel?view=approved" />
          <StatCard label="Docs pending" value={dash.documents_pending ?? 0} />
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 px-4 py-3 text-sm text-red-700 dark:text-red-400 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          Failed to load travel requests.
        </div>
      )}

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

      {loading ? (
        <div className="card p-12 text-center">
          <div className="flex items-center justify-center gap-2 text-neutral-400 dark:text-neutral-500">
            <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
            <span className="text-sm">Loading…</span>
          </div>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((r) => {
            const cfg = statusConfig[r.status] ?? { label: r.status, cls: "badge-muted" };
            const canEdit = r.status === "draft" || r.status === "returned_for_correction";
            return (
              <div key={r.id} className="card p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/travel/${r.id}`} className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900 truncate">{r.purpose}</p>
                      <span className={`badge ${cfg.cls}`}>{cfg.label}</span>
                    </div>
                    <p className="text-sm text-neutral-500 mt-1 flex flex-wrap items-center gap-3">
                      <span className="font-mono text-xs text-neutral-400">{r.reference_number}</span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">place</span>
                        {destination(r)}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">calendar_today</span>
                        {formatDateShort(r.departure_date)} – {formatDateShort(r.return_date)}
                      </span>
                    </p>
                  </Link>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link
                      href={`/travel/${r.id}`}
                      className="rounded-lg p-2 text-neutral-500 hover:bg-primary/10 hover:text-primary"
                      title="View"
                      aria-label={`View ${r.reference_number}`}
                    >
                      <span className="material-symbols-outlined text-[18px]">visibility</span>
                    </Link>
                    {canEdit && (
                      <Link
                        href={`/travel/${r.id}`}
                        className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                        title="Open to edit"
                        aria-label={`Edit ${r.reference_number}`}
                      >
                        <span className="material-symbols-outlined text-[18px]">edit</span>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-[28px] text-primary">flight</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">No travel requests found</p>
          <p className="mt-1 text-xs text-neutral-500">Create a requisition or adjust the status filter.</p>
          <Link href="/travel/create" className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm">
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Request
          </Link>
        </div>
      )}
    </div>
  );
}

export default function TravelPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-neutral-400">Loading travel…</div>}>
      <TravelPageInner />
    </Suspense>
  );
}
