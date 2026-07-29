"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import {
  DEFAULT_PAGE_SIZE,
  clientPageCount,
  getListData,
  slicePage,
} from "@/lib/listPagination";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  approved: { label: "Approved", badge: "badge-success" },
  submitted: { label: "Submitted", badge: "badge-warning" },
  resubmitted: { label: "Resubmitted", badge: "badge-warning" },
  rejected: { label: "Rejected", badge: "badge-danger" },
  draft: { label: "Draft", badge: "badge-muted" },
  cancelled: { label: "Cancelled", badge: "badge-muted" },
  withdrawn: { label: "Withdrawn", badge: "badge-muted" },
  returned_for_correction: { label: "Returned", badge: "badge-warning" },
  amendment_pending: { label: "Amendment", badge: "badge-warning" },
};

const STAGE_OPTIONS = [
  { value: "", label: "All stages" },
  { value: "submitted", label: "Submitted" },
  { value: "resubmitted", label: "Resubmitted" },
  { value: "approved", label: "Approved" },
  { value: "returned_for_correction", label: "Returned" },
  { value: "rejected", label: "Rejected" },
];

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "Newest first" },
  { value: "created_at:asc", label: "Oldest first" },
  { value: "departure_date:asc", label: "Departure ↑" },
  { value: "departure_date:desc", label: "Departure ↓" },
  { value: "requester:asc", label: "Requester A–Z" },
  { value: "status:asc", label: "Status" },
];

export type TravelQueueVariant = "approval" | "finance" | "admin" | "director-finance" | "retirement";

function destinationOf(row: TravelRequest): string {
  return (
    [row.destination_city, row.destination_country].filter(Boolean).join(", ") ||
    row.destination_country ||
    "—"
  );
}

function dsaOf(row: TravelRequest): number {
  return Number(row.finance_dsa_total ?? row.actual_dsa ?? row.estimated_dsa ?? 0) || 0;
}

function stageOf(row: TravelRequest): string {
  return row.workflow_stage || STATUS_CONFIG[row.status]?.label || row.status || "—";
}

function holdingOf(row: TravelRequest): string {
  if (row.pending_with_label) return row.pending_with_label;
  if (Array.isArray(row.pending_with) && row.pending_with.length) return row.pending_with.join(", ");
  if (row.status === "approved" && !row.director_finance_confirmed_at && row.finance_status) {
    return "Director Finance";
  }
  if (row.retirement_status && row.retirement_status !== "completed") {
    return row.requester?.name ? `${row.requester.name} (retirement)` : "Traveller (retirement)";
  }
  return "—";
}

function holdingUrgent(row: TravelRequest): boolean {
  if (row.retirement_status === "overdue") return true;
  if (row.status === "returned_for_correction") return true;
  if (Array.isArray(row.pending_with) && row.pending_with.length > 0) return true;
  if (row.pending_with_label && row.pending_with_label !== "—") return true;
  return false;
}

function storageKey(queue: string) {
  return `travel-queue-prefs:${queue}`;
}

type QueuePrefs = {
  search: string;
  stage: string;
  requesterId: string;
  dateFrom: string;
  dateTo: string;
  sort: string;
};

function loadPrefs(queue: string): QueuePrefs {
  if (typeof window === "undefined") {
    return { search: "", stage: "", requesterId: "", dateFrom: "", dateTo: "", sort: "created_at:desc" };
  }
  try {
    const raw = localStorage.getItem(storageKey(queue));
    if (!raw) return { search: "", stage: "", requesterId: "", dateFrom: "", dateTo: "", sort: "created_at:desc" };
    return { search: "", stage: "", requesterId: "", dateFrom: "", dateTo: "", sort: "created_at:desc", ...JSON.parse(raw) };
  } catch {
    return { search: "", stage: "", requesterId: "", dateFrom: "", dateTo: "", sort: "created_at:desc" };
  }
}

export function TravelQueueTable({
  queue,
  title,
  subtitle,
  variant,
  emptyHint,
}: {
  queue: string;
  title: string;
  subtitle: string;
  variant: TravelQueueVariant;
  emptyHint?: string;
}) {
  const initial = useMemo(() => loadPrefs(queue), [queue]);
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initial.search);
  const [stage, setStage] = useState(initial.stage);
  const [requesterId, setRequesterId] = useState(initial.requesterId);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [sort, setSort] = useState(initial.sort);
  const [page, setPage] = useState(1);
  const [travellers, setTravellers] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    const prefs = loadPrefs(queue);
    setSearch(prefs.search);
    setStage(prefs.stage);
    setRequesterId(prefs.requesterId);
    setDateFrom(prefs.dateFrom);
    setDateTo(prefs.dateTo);
    setSort(prefs.sort);
  }, [queue]);

  useEffect(() => {
    try {
      localStorage.setItem(
        storageKey(queue),
        JSON.stringify({ search, stage, requesterId, dateFrom, dateTo, sort }),
      );
    } catch {
      /* ignore */
    }
  }, [queue, search, stage, requesterId, dateFrom, dateTo, sort]);

  useEffect(() => {
    travelApi
      .travellers()
      .then((res) => setTravellers((res.data as { data?: Array<{ id: number; name: string }> })?.data ?? []))
      .catch(() => setTravellers([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sortField, sortDir] = (sort || "created_at:desc").split(":");
      const params: Record<string, string | number> = {
        queue,
        per_page: 100,
        sort: sortField || "created_at",
        sort_dir: sortDir || "desc",
      };
      if (search.trim()) params.search = search.trim();
      if (stage) params.stage = stage;
      if (requesterId) params.requester_id = Number(requesterId);
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const res = await travelApi.list(params);
      setRows(getListData<TravelRequest>(res.data));
    } catch {
      setError("Failed to load this queue.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queue, search, stage, requesterId, dateFrom, dateTo, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [search, stage, requesterId, dateFrom, dateTo, sort, queue]);

  const lastPage = clientPageCount(rows.length, DEFAULT_PAGE_SIZE);
  const safePage = Math.min(page, lastPage);
  const paged = useMemo(
    () => slicePage(rows, safePage, DEFAULT_PAGE_SIZE),
    [rows, safePage],
  );

  const holdingCount = useMemo(
    () => rows.filter((r) => holdingUrgent(r)).length,
    [rows],
  );

  const clearFilters = () => {
    setSearch("");
    setStage("");
    setRequesterId("");
    setDateFrom("");
    setDateTo("");
    setSort("created_at:desc");
  };

  const hasFilters = Boolean(search || stage || requesterId || dateFrom || dateTo || sort !== "created_at:desc");

  const handleExport = () => {
    if (rows.length === 0) return;
    exportToCsv(
      `travel-queue-${queue}-${new Date().toISOString().slice(0, 10)}.csv`,
      rows.map((r) => ({
        reference: r.reference_number,
        purpose: r.purpose,
        destination: destinationOf(r),
        requester: r.requester?.name ?? "",
        status: r.status,
        workflow_stage: stageOf(r),
        pending_with: holdingOf(r),
        finance_status: r.finance_status ?? "",
        estimated_dsa: r.estimated_dsa ?? "",
        finance_dsa_total: r.finance_dsa_total ?? r.actual_dsa ?? "",
        retirement_status: r.retirement_status ?? "",
        retirement_due_at: r.retirement_due_at ?? "",
        departure_date: r.departure_date ?? "",
        return_date: r.return_date ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "purpose", header: "Purpose" },
        { key: "destination", header: "Destination" },
        { key: "requester", header: "Requester" },
        { key: "status", header: "Status" },
        { key: "workflow_stage", header: "Workflow stage" },
        { key: "pending_with", header: "Holding up" },
        { key: "finance_status", header: "Finance status" },
        { key: "estimated_dsa", header: "Est. DSA" },
        { key: "finance_dsa_total", header: "Finance DSA" },
        { key: "retirement_status", header: "Retirement status" },
        { key: "retirement_due_at", header: "Retirement due" },
        { key: "departure_date", header: "Departure" },
        { key: "return_date", header: "Return" },
      ],
    );
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/travel" className="transition-colors hover:text-neutral-700">
              Travel
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">{title}</span>
          </div>
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={rows.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/travel/register" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">menu_book</span>
            Register
          </Link>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: "In queue", value: rows.length, icon: "inbox", color: "text-primary", bg: "bg-primary/10" },
            {
              label: "Holding attention",
              value: holdingCount,
              icon: "hourglass_top",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: "DSA total (shown)",
              value: formatCurrency(rows.reduce((sum, r) => sum + dsaOf(r), 0)),
              icon: "payments",
              color: "text-green-600",
              bg: "bg-green-50",
            },
          ].map((s) => (
            <div key={s.label} className="card p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="mt-0.5 text-lg font-bold text-neutral-900">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, purpose…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <select
              className="form-input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label="Filter by stage"
            >
              {STAGE_OPTIONS.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="form-input"
              value={requesterId}
              onChange={(e) => setRequesterId(e.target.value)}
              aria-label="Filter by requester"
            >
              <option value="">All requesters</option>
              {travellers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              aria-label="Departure from"
              title="Departure from"
            />
          </div>
          <div>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label="Departure to"
              title="Departure to"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="form-input max-w-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort queue"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="text-xs font-medium text-primary hover:underline" onClick={clearFilters}>
              Clear filters
            </button>
          )}
          <span className="text-[11px] text-neutral-400">Sort & filters persist for this queue</span>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">
              {hasFilters ? "filter_alt_off" : "inbox"}
            </span>
            <p className="text-sm font-semibold text-neutral-600">
              {hasFilters ? "No matches for these filters" : "No items in this queue"}
            </p>
            <p className="mt-1 text-xs text-neutral-400">
              {hasFilters
                ? "Try clearing stage, requester, or date range."
                : emptyHint ?? "Nothing awaiting action right now."}
            </p>
            {hasFilters && (
              <button type="button" className="btn-secondary mt-4 text-sm" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Purpose</th>
                    <th>Destination</th>
                    <th>Requester</th>
                    <th>Stage</th>
                    <th>Holding up</th>
                    {variant === "finance" && <th>Est. DSA</th>}
                    {variant === "finance" && <th>Finance</th>}
                    {variant === "director-finance" && <th>DSA total</th>}
                    {variant === "retirement" && <th>Retirement</th>}
                    {variant === "retirement" && <th>Due</th>}
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((t) => {
                    const sc = STATUS_CONFIG[t.status] ?? { label: t.status || "Unknown", badge: "badge-muted" };
                    const holding = holdingOf(t);
                    const urgent = holdingUrgent(t);
                    return (
                      <tr key={t.id} className={urgent ? "bg-amber-50/40" : undefined}>
                        <td className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                          {t.reference_number ?? "—"}
                        </td>
                        <td className="max-w-[200px] truncate font-medium text-neutral-900">{t.purpose ?? "—"}</td>
                        <td className="text-sm text-neutral-600 whitespace-nowrap">{destinationOf(t)}</td>
                        <td className="text-sm text-neutral-700 whitespace-nowrap">{t.requester?.name ?? "—"}</td>
                        <td>
                          <span className="badge badge-muted text-xs">{stageOf(t)}</span>
                        </td>
                        <td className="text-sm text-neutral-700 max-w-[180px]">
                          <span
                            className={`inline-flex items-start gap-1 line-clamp-2 ${urgent ? "font-semibold text-amber-800" : ""}`}
                            title={holding}
                          >
                            {urgent && (
                              <span className="material-symbols-outlined mt-0.5 text-[14px] text-amber-600">
                                hourglass_top
                              </span>
                            )}
                            {holding}
                          </span>
                        </td>
                        {variant === "finance" && (
                          <td className="whitespace-nowrap text-sm">
                            {formatCurrency(Number(t.estimated_dsa ?? 0))} {t.currency ?? ""}
                          </td>
                        )}
                        {variant === "finance" && (
                          <td>
                            <span className="badge badge-warning text-xs capitalize">
                              {(t.finance_status ?? "awaiting").replace(/_/g, " ")}
                            </span>
                          </td>
                        )}
                        {variant === "director-finance" && (
                          <td className="whitespace-nowrap font-semibold text-sm">
                            {formatCurrency(dsaOf(t))}
                          </td>
                        )}
                        {variant === "retirement" && (
                          <td>
                            <span className="badge badge-warning text-xs capitalize">
                              {(t.retirement_status ?? "pending").replace(/_/g, " ")}
                            </span>
                          </td>
                        )}
                        {variant === "retirement" && (
                          <td className="text-xs text-neutral-500 whitespace-nowrap">
                            {t.retirement_due_at ? formatDateShort(t.retirement_due_at) : "—"}
                          </td>
                        )}
                        <td>
                          <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                        </td>
                        <td>
                          <Link
                            href={`/travel/${t.id}`}
                            className="text-xs font-medium text-primary hover:underline"
                          >
                            Open
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <ListPagination
              page={safePage}
              lastPage={lastPage}
              total={rows.length}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
