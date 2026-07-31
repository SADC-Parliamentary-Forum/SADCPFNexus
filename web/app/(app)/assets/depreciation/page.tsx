"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import api from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatCurrency, formatDateRangeTable, formatDateTable } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { getLastPage, getListData, getTotal } from "@/lib/listPagination";
import { ListPagination } from "@/components/ui/ListPagination";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

type Runner = { id: number; name: string };

type DepreciationRun = {
  id: number;
  run_date: string;
  period_start?: string | null;
  period_end?: string | null;
  asset_count: number | null;
  total_depreciation: number | string | null;
  status: string;
  runner?: Runner | null;
  created_at?: string | null;
};

type RunLine = {
  id: number;
  opening_book_value: number | string | null;
  depreciation_amount: number | string | null;
  closing_book_value: number | string | null;
  accumulated_depreciation: number | string | null;
  asset?: {
    id: number;
    asset_code?: string | null;
    name?: string | null;
    tag_number?: string | null;
    category?: string | null;
  } | null;
};

type RunDetail = DepreciationRun & {
  lines?: RunLine[];
  policy?: { id: number; version?: string | null; method?: string | null } | null;
};

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  completed: { label: "Completed", badge: "badge-success" },
  draft: { label: "Draft", badge: "badge-muted" },
  locked: { label: "Locked", badge: "badge-info" },
  failed: { label: "Failed", badge: "badge-danger" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "completed", label: "Completed" },
  { key: "draft", label: "Draft" },
  { key: "locked", label: "Locked" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function money(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return formatCurrency(n, "NAD");
}

function statusMeta(status: string | null | undefined) {
  const key = (status ?? "").toLowerCase();
  return STATUS_CONFIG[key] ?? {
    label: status ? status.replace(/_/g, " ") : "Unknown",
    badge: "badge-muted",
  };
}

function canRunDepreciation(): boolean {
  const user = getStoredUser();
  if (!user) return false;
  if (isSystemAdmin(user)) return true;
  return hasPermission(user, ["assets.admin", "finance.approve"]);
}

function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
    ?.response?.data;
  if (data?.message) return data.message;
  const first = Object.values(data?.errors ?? {}).flat()[0];
  return first || fallback;
}

export default function AssetDepreciationPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { confirm } = useConfirm();
  const [runs, setRuns] = useState<DepreciationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [canRun, setCanRun] = useState(false);

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RunDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);


  const load = useCallback(async (pageOverride?: number) => {
    const pageToLoad = pageOverride ?? page;
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = { page: pageToLoad, per_page: 25 };
      if (filter !== "all") params.status = filter;
      const res = await api.get("/assets-meta/depreciation-runs", { params });
      const payload = res.data;
      setRuns(getListData<DepreciationRun>(payload));
      setLastPage(getLastPage(payload));
      setTotal(getTotal(payload, getListData(payload).length));
    } catch (err) {
      setRuns([]);
      setLastPage(1);
      setTotal(0);
      setError(apiErrorMessage(err, "Failed to load depreciation runs."));
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    setCanRun(canRunDepreciation());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredRuns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter((r) => {
      const hay = [
        r.status,
        r.run_date,
        r.period_start,
        r.period_end,
        r.runner?.name,
        String(r.asset_count ?? ""),
        String(r.total_depreciation ?? ""),
        String(r.id),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [runs, search]);

  const stats = useMemo(() => {
    const source = filteredRuns;
    const completed = source.filter((r) => (r.status ?? "").toLowerCase() === "completed").length;
    const assetsTouched = source.reduce((sum, r) => sum + (Number(r.asset_count) || 0), 0);
    const depreciationSum = source.reduce((sum, r) => {
      const n = Number(r.total_depreciation);
      return sum + (Number.isFinite(n) ? n : 0);
    }, 0);
    return {
      total,
      completed,
      assetsTouched,
      depreciationSum,
    };
  }, [filteredRuns, total]);

  const toggleExpand = async (run: DepreciationRun) => {
    if (expandedId === run.id) {
      setExpandedId(null);
      setDetail(null);
      setDetailError(null);
      return;
    }
    setExpandedId(run.id);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const res = await api.get<{ data: RunDetail }>(`/assets-meta/depreciation-runs/${run.id}`);
      setDetail(res.data.data ?? null);
    } catch (err) {
      setDetailError(apiErrorMessage(err, "Unable to load run lines."));
    } finally {
      setDetailLoading(false);
    }
  };

  const runNow = async () => {
    if (!canRun) {
      setError("You need assets.admin or finance.approve to run depreciation.");
      return;
    }
    const ok = await confirm({
      title: "Run monthly depreciation?",
      message:
        "This updates book values for monitoring/reports. Official GL remains the accounting system.",
      confirmText: "Run depreciation",
      variant: "primary",
    });
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await api.post<{ data: RunDetail; message?: string }>("/assets-meta/depreciation-runs", {
        as_of: asOf || undefined,
      });
      success(res.data.message ?? "Depreciation run completed (monitoring only).");
      if (page !== 1) setPage(1);
      await load(1);
      if (res.data.data?.id) {
        setExpandedId(res.data.data.id);
        setDetail(res.data.data);
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Unable to run depreciation."));
    } finally {
      setBusy(false);
    }
  };

  const handleExport = () => {
    if (!filteredRuns.length) {
      success("No runs to export.");
      return;
    }
    exportToCsv(
      `depreciation-runs-${new Date().toISOString().slice(0, 10)}.csv`,
      filteredRuns.map((r) => ({
        id: r.id,
        run_date: r.run_date,
        period_start: r.period_start ?? "",
        period_end: r.period_end ?? "",
        asset_count: r.asset_count ?? 0,
        total_depreciation: r.total_depreciation ?? "",
        status: r.status,
        run_by: r.runner?.name ?? "",
      })),
      [
        { key: "id", header: "Run ID" },
        { key: "run_date", header: "Run date" },
        { key: "period_start", header: "Period start" },
        { key: "period_end", header: "Period end" },
        { key: "asset_count", header: "Assets" },
        { key: "total_depreciation", header: "Total depreciation" },
        { key: "status", header: "Status" },
        { key: "run_by", header: "Run by" },
      ],
    );
    success(`Exported ${filteredRuns.length} run(s).`);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/assets" className="transition-colors hover:text-neutral-700">
              Fixed Assets
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Depreciation</span>
          </div>
          <h1 className="page-title">Depreciation</h1>
          <p className="page-subtitle">
            Monthly monitoring runs for capital assets. Nexus calculates book values for reports —
            official GL remains the accounting system.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="as_of">
              As of
            </label>
            <input
              id="as_of"
              type="date"
              className="form-input text-sm"
              value={asOf}
              onChange={(e) => setAsOf(e.target.value)}
              disabled={busy}
            />
          </div>
          <button type="button" className="btn-secondary text-sm" onClick={handleExport} disabled={loading || filteredRuns.length === 0}>
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          {canRun && (
            <button type="button" className="btn-primary text-sm disabled:opacity-50" disabled={busy} onClick={() => void runNow()}>
              <span className="material-symbols-outlined text-[18px]">calculate</span>
              {busy ? "Running…" : "Run depreciation"}
            </button>
          )}
        </div>
      </div>
{error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => void load()}>
            Retry
          </button>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {!loading && filteredRuns.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Runs (page)", value: stats.total, icon: "history", color: "text-primary", bg: "bg-primary/10" },
            { label: "Completed (page)", value: stats.completed, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
            { label: "Assets touched", value: stats.assetsTouched, icon: "inventory_2", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Depreciation (page)", value: money(stats.depreciationSum), icon: "trending_down", color: "text-neutral-700", bg: "bg-neutral-100" },
          ].map((s) => (
            <div key={s.label} className="card p-4">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-neutral-500">{s.label}</p>
                  <p className="mt-0.5 truncate text-lg font-bold text-neutral-900">{s.value}</p>
                </div>
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s.bg}`}>
                  <span className={`material-symbols-outlined text-[18px] ${s.color}`}>{s.icon}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-neutral-600" htmlFor="depr-search">
            Search
          </label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-neutral-400">
              search
            </span>
            <input
              id="depr-search"
              className="form-input pl-8 text-sm"
              placeholder="Status, run date, period, runner…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pb-0.5">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setPage(1);
                setFilter(tab.key);
              }}
              className={`filter-tab ${filter === tab.key ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : filteredRuns.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-[28px] text-primary">trending_down</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">
            {error
              ? "Could not load depreciation runs"
              : runs.length === 0
                ? "No depreciation runs yet"
                : "No runs match your search"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {error
              ? "Check your connection or permissions, then retry."
              : runs.length === 0
                ? canRun
                  ? "Run the first monthly calculation to populate this register."
                  : "An assets or finance administrator can run the first calculation."
                : "Try another status filter or clear the search."}
          </p>
          {runs.length > 0 ? (
            <button
              type="button"
              className="mt-4 text-xs font-semibold text-primary hover:underline"
              onClick={() => {
                setSearch("");
                setFilter("all");
              }}
            >
              Clear filters
            </button>
          ) : (
            canRun &&
            !error && (
              <button type="button" className="btn-primary mt-4 text-sm" disabled={busy} onClick={() => void runNow()}>
                Run depreciation
              </button>
            )
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-10" />
                  <th>Run date</th>
                  <th>Period</th>
                  <th className="text-right">Assets</th>
                  <th className="text-right">Total depreciation</th>
                  <th>Status</th>
                  <th>Run by</th>
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map((r) => {
                  const meta = statusMeta(r.status);
                  const open = expandedId === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr className={open ? "bg-primary/[0.03]" : undefined}>
                        <td>
                          <button
                            type="button"
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                            aria-expanded={open}
                            aria-label={open ? "Hide run lines" : "Show run lines"}
                            onClick={() => void toggleExpand(r)}
                          >
                            <span className="material-symbols-outlined text-[20px]">
                              {open ? "expand_less" : "expand_more"}
                            </span>
                          </button>
                        </td>
                        <td className="font-medium text-neutral-900">{formatDateTable(r.run_date)}</td>
                        <td className="text-neutral-600">
                          {formatDateRangeTable(r.period_start, r.period_end)}
                        </td>
                        <td className="text-right tabular-nums">{r.asset_count ?? "—"}</td>
                        <td className="text-right tabular-nums font-medium">{money(r.total_depreciation)}</td>
                        <td>
                          <span className={`badge ${meta.badge}`}>{meta.label}</span>
                        </td>
                        <td className="text-neutral-600">{r.runner?.name ?? "—"}</td>
                      </tr>
                      {open && (
                        <tr>
                          <td colSpan={7} className="bg-neutral-50/80 px-4 py-4">
                            {detailLoading && (
                              <div className="space-y-2">
                                {[0, 1, 2].map((i) => (
                                  <div key={i} className="h-9 animate-pulse rounded-lg bg-neutral-200/70" />
                                ))}
                              </div>
                            )}
                            {detailError && (
                              <p className="text-sm text-red-700">{detailError}</p>
                            )}
                            {!detailLoading && !detailError && detail && (
                              <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
                                    Run #{detail.id} lines
                                    {detail.policy?.version ? ` · Policy ${detail.policy.version}` : ""}
                                  </p>
                                  <p className="text-xs text-neutral-500">
                                    {(detail.lines ?? []).length} asset line(s)
                                  </p>
                                </div>
                                {(detail.lines ?? []).length === 0 ? (
                                  <p className="text-sm text-neutral-500">No asset lines on this run.</p>
                                ) : (
                                  <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
                                    <table className="data-table text-sm">
                                      <thead>
                                        <tr>
                                          <th>Asset</th>
                                          <th>Tag</th>
                                          <th className="text-right">Opening BV</th>
                                          <th className="text-right">Depreciation</th>
                                          <th className="text-right">Closing BV</th>
                                          <th className="text-right">Accumulated</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(detail.lines ?? []).map((line) => (
                                          <tr key={line.id}>
                                            <td>
                                              <div className="font-medium text-neutral-900">
                                                {line.asset?.asset_code ?? `Asset #${line.asset?.id ?? "—"}`}
                                              </div>
                                              <div className="text-xs text-neutral-500">{line.asset?.name ?? "—"}</div>
                                            </td>
                                            <td className="text-neutral-600">{line.asset?.tag_number ?? "—"}</td>
                                            <td className="text-right tabular-nums">{money(line.opening_book_value)}</td>
                                            <td className="text-right tabular-nums font-medium text-amber-800">
                                              {money(line.depreciation_amount)}
                                            </td>
                                            <td className="text-right tabular-nums">{money(line.closing_book_value)}</td>
                                            <td className="text-right tabular-nums">{money(line.accumulated_depreciation)}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ListPagination
            page={page}
            lastPage={lastPage}
            total={total}
            onPageChange={setPage}
            disabled={loading}
          />
        </div>
      )}
    </div>
  );
}
