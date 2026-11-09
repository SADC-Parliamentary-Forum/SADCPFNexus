"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { ListPagination } from "@/components/ui/ListPagination";
import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import {
  DEFAULT_PAGE_SIZE,
  clientPageCount,
  getListData,
  slicePage,
} from "@/lib/listPagination";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type T = (key: string, vars?: Record<string, string | number>) => string;

/** Display keys for stage and status labels; the English labels stay the filter values sent to the API. */
const LABEL_KEYS: Record<string, string> = {
  "All stages": "travel.queueTable.label.allStages",
  Draft: "travel.queueTable.label.draft",
  Submitted: "travel.queueTable.label.submitted",
  Resubmitted: "travel.queueTable.label.resubmitted",
  "Direct Supervisor": "travel.queueTable.label.directSupervisor",
  "Administration Officer": "travel.queueTable.label.adminOfficer",
  "Finance Controller": "travel.queueTable.label.financeController",
  Director: "travel.queueTable.label.director",
  "Secretary General": "travel.queueTable.label.secretaryGeneral",
  "Returned for correction": "travel.queueTable.label.returnedForCorrection",
  Approved: "travel.queueTable.label.approved",
  Rejected: "travel.queueTable.label.rejected",
  Cancelled: "travel.queueTable.label.cancelled",
  Withdrawn: "travel.queueTable.label.withdrawn",
  Returned: "travel.queueTable.label.returned",
  Amendment: "travel.queueTable.label.amendment",
  "Director Finance": "travel.queueTable.label.directorFinance",
  Unknown: "travel.queueTable.label.unknown",
};

function labelText(label: string, t: T): string {
  const key = LABEL_KEYS[label];
  return key ? t(key) : label;
}

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

/** Canonical labels — same strings `workflow_stage` / Stage column show (not raw status keys). */
const CANONICAL_STAGE_OPTIONS = [
  { value: "", label: "All stages" },
  { value: "Draft", label: "Draft" },
  { value: "Submitted", label: "Submitted" },
  { value: "Resubmitted", label: "Resubmitted" },
  { value: "Direct Supervisor", label: "Direct Supervisor" },
  { value: "Administration Officer", label: "Administration Officer" },
  { value: "Finance Controller", label: "Finance Controller" },
  { value: "Director", label: "Director" },
  { value: "Secretary General", label: "Secretary General" },
  { value: "Returned for correction", label: "Returned for correction" },
  { value: "Approved", label: "Approved" },
  { value: "Rejected", label: "Rejected" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "Withdrawn", label: "Withdrawn" },
];

/** Migrate older localStorage prefs that stored raw status keys. */
const LEGACY_STAGE_STATUS_TO_LABEL: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  resubmitted: "Resubmitted",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
  withdrawn: "Withdrawn",
  returned_for_correction: "Returned for correction",
  Returned: "Returned for correction",
};

function normalizeStagePref(raw: string): string {
  if (!raw) return "";
  return LEGACY_STAGE_STATUS_TO_LABEL[raw] ?? raw;
}

const SORT_OPTIONS = [
  { value: "created_at:desc", label: "travel.queueTable.sort.newest" },
  { value: "created_at:asc", label: "travel.queueTable.sort.oldest" },
  { value: "departure_date:asc", label: "travel.queueTable.sort.departureAsc" },
  { value: "departure_date:desc", label: "travel.queueTable.sort.departureDesc" },
  { value: "requester:asc", label: "travel.queueTable.sort.requester" },
  { value: "status:asc", label: "travel.queueTable.sort.status" },
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

function holdingOf(row: TravelRequest, t: T): string {
  if (row.pending_with_label) return row.pending_with_label;
  if (Array.isArray(row.pending_with) && row.pending_with.length) return row.pending_with.join(", ");
  if (row.status === "approved" && !row.director_finance_confirmed_at && row.finance_status) {
    return t("travel.queueTable.label.directorFinance");
  }
  if (row.retirement_status && row.retirement_status !== "completed") {
    return row.requester?.name ? t("travel.queueTable.holding.retirement", { name: row.requester.name }) : t("travel.queueTable.holding.traveller");
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
  const { t } = useI18n();
  const tv = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };
  const initial = useMemo(() => loadPrefs(queue), [queue]);
  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState(initial.search);
  const [stage, setStage] = useState(() => normalizeStagePref(initial.stage));
  const [requesterId, setRequesterId] = useState(initial.requesterId);
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [sort, setSort] = useState(initial.sort);
  const [page, setPage] = useState(1);
  const [travellers, setTravellers] = useState<Array<{ id: number; name: string }>>([]);

  useEffect(() => {
    const prefs = loadPrefs(queue);
    setSearch(prefs.search);
    setStage(normalizeStagePref(prefs.stage));
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
      setError(t("travel.queueTable.loadFailed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [queue, search, stage, requesterId, dateFrom, dateTo, sort, t]);

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

  const stageOptions = useMemo(() => {
    const seen = new Set(CANONICAL_STAGE_OPTIONS.map((o) => o.value));
    const extras = rows
      .map((r) => stageOf(r))
      .filter((s) => Boolean(s) && s !== "—" && !seen.has(s))
      .filter((s, i, arr) => arr.indexOf(s) === i)
      .map((s) => ({ value: s, label: s }));
    if (stage && !seen.has(stage) && !extras.some((e) => e.value === stage)) {
      extras.push({ value: stage, label: stage });
    }
    return [...CANONICAL_STAGE_OPTIONS, ...extras];
  }, [rows, stage]);

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
        pending_with: holdingOf(r, t),
        finance_status: r.finance_status ?? "",
        estimated_dsa: r.estimated_dsa ?? "",
        finance_dsa_total: r.finance_dsa_total ?? r.actual_dsa ?? "",
        retirement_status: r.retirement_status ?? "",
        retirement_due_at: r.retirement_due_at ?? "",
        departure_date: r.departure_date ?? "",
        return_date: r.return_date ?? "",
      })),
      [
        { key: "reference", header: t("travel.queueTable.col.reference") },
        { key: "purpose", header: t("travel.queueTable.col.purpose") },
        { key: "destination", header: t("travel.queueTable.col.destination") },
        { key: "requester", header: t("travel.queueTable.col.requester") },
        { key: "status", header: t("travel.queueTable.col.status") },
        { key: "workflow_stage", header: t("travel.queueTable.col.workflowStage") },
        { key: "pending_with", header: t("travel.queueTable.col.holdingUp") },
        { key: "finance_status", header: t("travel.queueTable.col.financeStatus") },
        { key: "estimated_dsa", header: t("travel.queueTable.col.estDsa") },
        { key: "finance_dsa_total", header: t("travel.queueTable.col.financeDsa") },
        { key: "retirement_status", header: t("travel.queueTable.col.retirementStatus") },
        { key: "retirement_due_at", header: t("travel.queueTable.col.retirementDue") },
        { key: "departure_date", header: t("travel.queueTable.col.departure") },
        { key: "return_date", header: t("travel.queueTable.col.return") },
      ],
    );
  };

  return (
    <div className="w-full min-w-0 space-y-5">
      <ModulePageHeader
        title={title}
        subtitle={subtitle}
        breadcrumbs={
          <PageBreadcrumbs items={[{ label: "nav.travel", href: "/travel" }, { label: title }]} />
        }
        actions={
          <>
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-50"
              disabled={rows.length === 0}
              onClick={handleExport}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {t("travel.queueTable.exportCsv")}
            </button>
            <Link href="/travel/register" className="btn-secondary text-sm">
              <span className="material-symbols-outlined text-[18px]">menu_book</span>
              {t("travel.queueTable.register")}
            </Link>
          </>
        }
      />

      {error && (
        <ErrorBanner message={error} onRetry={() => void load()} />
      )}

      {!loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {[
            { label: t("travel.queueTable.stat.inQueue"), value: rows.length, icon: "inbox", color: "text-primary", bg: "bg-primary/10" },
            {
              label: t("travel.queueTable.stat.holding"),
              value: holdingCount,
              icon: "hourglass_top",
              color: "text-amber-600",
              bg: "bg-amber-50",
            },
            {
              label: t("travel.queueTable.stat.dsaTotal"),
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

      <div className="card space-y-3 p-4" data-testid="travel-queue-filters">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <div className="relative xl:col-span-2">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 text-[20px]">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("travel.queueTable.searchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="travel-queue-search"
            />
          </div>
          <div>
            <select
              className="form-input"
              value={stage}
              onChange={(e) => setStage(e.target.value)}
              aria-label={t("travel.queueTable.filterStage")}
              data-testid="travel-queue-stage-filter"
            >
              {stageOptions.map((o) => (
                <option key={o.value || "all"} value={o.value}>
                  {labelText(o.label, t)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="form-input"
              value={requesterId}
              onChange={(e) => setRequesterId(e.target.value)}
              aria-label={t("travel.queueTable.filterRequester")}
              data-testid="travel-queue-requester-filter"
            >
              <option value="">{t("travel.queueTable.allRequesters")}</option>
              {travellers.map((row) => (
                <option key={row.id} value={row.id}>
                  {row.name}
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
              aria-label={t("travel.queueTable.departureFrom")}
              title={t("travel.queueTable.departureFrom")}
              data-testid="travel-queue-date-from"
            />
          </div>
          <div>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              aria-label={t("travel.queueTable.departureTo")}
              title={t("travel.queueTable.departureTo")}
              data-testid="travel-queue-date-to"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="form-input max-w-xs"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label={t("travel.queueTable.sortQueue")}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {t(o.label)}
              </option>
            ))}
          </select>
          {hasFilters && (
            <button type="button" className="btn-secondary text-xs" onClick={clearFilters}>
              {t("travel.queueTable.clearFilters")}
            </button>
          )}
          <span className="text-[11px] text-neutral-400">{t("travel.queueTable.persist")}</span>
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
          <EmptyState
            icon={hasFilters ? "filter_alt_off" : "inbox"}
            title={hasFilters ? t("travel.queueTable.noMatches") : t("travel.queueTable.empty")}
            description={
              hasFilters
                ? t("travel.queueTable.noMatchesHint")
                : emptyHint ?? t("travel.queueTable.emptyHint")
            }
            action={
              hasFilters ? (
                <button type="button" className="btn-secondary text-sm" onClick={clearFilters}>
                  {t("travel.queueTable.clearFilters")}
                </button>
              ) : null
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table w-full">
                <thead>
                  <tr>
                    <th>{t("travel.queueTable.col.reference")}</th>
                    <th>{t("travel.queueTable.col.purpose")}</th>
                    <th>{t("travel.queueTable.col.destination")}</th>
                    <th>{t("travel.queueTable.col.requester")}</th>
                    <th>{t("travel.queueTable.col.stage")}</th>
                    <th>{t("travel.queueTable.col.holdingUp")}</th>
                    {variant === "finance" && <th>{t("travel.queueTable.col.estDsa")}</th>}
                    {variant === "finance" && <th>{t("travel.queueTable.col.finance")}</th>}
                    {variant === "director-finance" && <th>{t("travel.queueTable.col.dsaTotal")}</th>}
                    {variant === "retirement" && <th>{t("travel.queueTable.col.retirement")}</th>}
                    {variant === "retirement" && <th>{t("travel.queueTable.col.due")}</th>}
                    <th>{t("travel.queueTable.col.status")}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map((row) => {
                    const sc = STATUS_CONFIG[row.status] ?? { label: row.status || "Unknown", badge: "badge-muted" }; // i18n-ignore
                    const holding = holdingOf(row, t);
                    const urgent = holdingUrgent(row);
                    return (
                      <tr key={row.id} className={urgent ? "bg-amber-50/40" : undefined}>
                        <td className="font-mono text-xs text-neutral-600 whitespace-nowrap">
                          {row.reference_number ?? "—"}
                        </td>
                        <td className="max-w-[200px] truncate font-medium text-neutral-900">{row.purpose ?? "—"}</td>
                        <td className="text-sm text-neutral-600 whitespace-nowrap">{destinationOf(row)}</td>
                        <td className="text-sm text-neutral-700 whitespace-nowrap">{row.requester?.name ?? "—"}</td>
                        <td>
                          <span className="badge badge-muted text-xs">{labelText(stageOf(row), t)}</span>
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
                            {formatCurrency(Number(row.estimated_dsa ?? 0))} {row.currency ?? ""}
                          </td>
                        )}
                        {variant === "finance" && (
                          <td>
                            <span className="badge badge-warning text-xs capitalize">
                              {row.finance_status ? tv(`travel.queueTable.status.${row.finance_status}`, row.finance_status.replace(/_/g, " ")) : t("travel.queueTable.status.awaiting")}
                            </span>
                          </td>
                        )}
                        {variant === "director-finance" && (
                          <td className="whitespace-nowrap font-semibold text-sm">
                            {formatCurrency(dsaOf(row))}
                          </td>
                        )}
                        {variant === "retirement" && (
                          <td>
                            <span className="badge badge-warning text-xs capitalize">
                              {row.retirement_status ? tv(`travel.queueTable.status.${row.retirement_status}`, row.retirement_status.replace(/_/g, " ")) : t("travel.queueTable.status.pending")}
                            </span>
                          </td>
                        )}
                        {variant === "retirement" && (
                          <td className="text-xs text-neutral-500 whitespace-nowrap">
                            {row.retirement_due_at ? formatDateShort(row.retirement_due_at) : "—"}
                          </td>
                        )}
                        <td>
                          <span className={`badge text-xs ${sc.badge}`}>{labelText(sc.label, t)}</span>
                        </td>
                        <td>
                          <Link
                            href={`/travel/${row.id}`}
                            className="btn-secondary py-1 px-2 text-xs"
                          >
                            {t("travel.queueTable.open")}
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
