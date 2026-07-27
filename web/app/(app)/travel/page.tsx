"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";

const statusConfig: Record<string, { label: string; cls: string }> = {
  approved:  { label: "Approved",  cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected:  { label: "Rejected",  cls: "badge-danger"  },
  draft:     { label: "Draft",     cls: "badge-muted"   },
  cancelled: { label: "Cancelled", cls: "badge-muted"   },
  returned_for_correction: { label: "Returned", cls: "badge-warning" },
};

const FILTERS = ["All", "Draft", "Submitted", "Approved", "Rejected"] as const;
const filterMap: Record<string, string | undefined> = {
  All: undefined, Draft: "draft", Submitted: "submitted", Approved: "approved", Rejected: "rejected",
};

function StatCard({ label, value, href }: { label: string; value: number | string; href?: string }) {
  const inner = (
    <div className="card p-4">
      <p className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
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
  const [search, setSearch] = useState("");

  const { data: dash } = useQuery({
    queryKey: ["travel", "dashboard", "traveller"],
    queryFn: () => travelApi.dashboardTraveller().then((r) => r.data.data),
    staleTime: 30_000,
  });

  const listParams = useMemo(() => {
    const params: Record<string, string | number> = { per_page: 100 };
    const status = filterMap[statusFilter];
    if (status) params.status = status;
    if (scope === "mine") params.scope = "mine";
    return params;
  }, [statusFilter, scope]);

  const { data: requests = [], isLoading: loading, isError, refetch } = useQuery({
    queryKey: ["travel", "list", listParams, view],
    queryFn: () => travelApi.list(listParams).then((res) => {
      const payload = res.data as { data?: TravelRequest[] | { data?: TravelRequest[] } };
      const data = payload.data;
      if (Array.isArray(data)) return data;
      if (data && typeof data === "object" && Array.isArray(data.data)) return data.data;
      return [];
    }),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    let rows = requests;
    if (view === "upcoming") {
      rows = rows.filter((r) => r.status === "approved" && r.departure_date > today);
    } else if (view === "away") {
      rows = rows.filter((r) => r.status === "approved" && r.departure_date <= today && r.return_date >= today);
    } else if (view === "approved") {
      rows = rows.filter((r) => r.status === "approved");
    }
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.reference_number, r.purpose, r.destination_city, r.destination_country, r.status]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, view, search]);

  const destination = (r: TravelRequest) =>
    [r.destination_city, r.destination_country].filter(Boolean).join(", ") || r.destination_country;

  const title = view === "upcoming" ? "Upcoming Travel"
    : view === "away" ? "Travellers Away"
    : view === "approved" ? "Approved Travel"
    : scope === "mine" ? "My Travel Requests"
    : "Travel Dashboard";

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `travel-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        purpose: r.purpose,
        destination: destination(r),
        status: r.status,
        departure_date: r.departure_date,
        return_date: r.return_date,
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "purpose", header: "Purpose" },
        { key: "destination", header: "Destination" },
        { key: "status", header: "Status" },
        { key: "departure_date", header: "Departure" },
        { key: "return_date", header: "Return" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">Manage travel requisitions, readiness, and retirement.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/travel/register" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Register
          </Link>
          <Link href="/travel/calendar" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            Calendar
          </Link>
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/travel/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Request
          </Link>
        </div>
      </div>

      {dash && !view && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="travel-traveller-dashboard">
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
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">Failed to load travel requests.</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
            Retry
          </button>
        </div>
      )}

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, purpose, destination…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={`filter-tab ${statusFilter === f ? "active" : ""}`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card space-y-3 p-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : filtered.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Purpose</th>
                  <th>Destination</th>
                  <th>Dates</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const cfg = statusConfig[r.status] ?? { label: r.status, cls: "badge-muted" };
                  const canEdit = r.status === "draft" || r.status === "returned_for_correction";
                  return (
                    <tr key={r.id}>
                      <td className="font-mono text-xs text-neutral-600">{r.reference_number}</td>
                      <td className="max-w-[220px] truncate font-medium text-neutral-900">{r.purpose}</td>
                      <td className="text-sm text-neutral-600">{destination(r)}</td>
                      <td className="whitespace-nowrap text-xs text-neutral-500">
                        {formatDateShort(r.departure_date)} – {formatDateShort(r.return_date)}
                      </td>
                      <td><span className={`badge text-xs ${cfg.cls}`}>{cfg.label}</span></td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/travel/${r.id}`} className="text-xs font-medium text-primary hover:underline">
                            View
                          </Link>
                          {canEdit && (
                            <Link href={`/travel/${r.id}`} className="text-xs font-medium text-neutral-600 hover:underline">
                              Edit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
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
