"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { leaveApi, type LeaveRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { ListPagination } from "@/components/ui/ListPagination";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";

const TYPE_LABELS: Record<string, string> = {
  annual: "Annual",
  sick: "Sick",
  lil: "Leave in Lieu",
  special: "Special",
  maternity: "Maternity",
  paternity: "Paternity",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected: { label: "Rejected", cls: "badge-danger" },
  draft: { label: "Draft", cls: "badge-muted" },
  cancelled: { label: "Cancelled", cls: "badge-muted" },
  withdrawn: { label: "Withdrawn", cls: "badge-muted" },
  returned_for_correction: { label: "Returned", cls: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "returned_for_correction", label: "Returned" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

interface Balances {
  annual_balance_days: number;
  lil_hours_available: number;
  sick_leave_used_days: number;
  special_leave_days_used?: number;
  maternity_leave_days_used?: number;
  paternity_leave_days_used?: number;
}

function unwrapList(payload: unknown): LeaveRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as LeaveRequest[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: LeaveRequest[] }).data;
  }
  return [];
}

export default function LeavePage() {
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const {
    data: requests = [],
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["leave", "list"],
    queryFn: () => leaveApi.list({ per_page: 100 }).then((res) => unwrapList(res.data)),
    staleTime: 30_000,
  });

  const { data: balances = null } = useQuery({
    queryKey: ["leave", "balances"],
    queryFn: () => leaveApi.getBalances().then((res) => res.data as Balances),
    staleTime: 5 * 60_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.reason,
        row.leave_type,
        row.status,
        row.requester?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [requests, filter, search]);

  const lastPage = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(() => slicePage(filtered, Math.min(page, lastPage), DEFAULT_PAGE_SIZE), [filtered, page, lastPage]);

  const getId = useCallback((row: LeaveRequest) => row.id, []);
  const canSelectDraft = useCallback((row: LeaveRequest) => row.status === "draft", []);
  const selection = useRowSelection({
    rows: filter === "draft" ? filtered : filtered.filter((r) => r.status === "draft"),
    getId,
    canSelect: canSelectDraft,
  });

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `leave-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        type: r.leave_type,
        status: r.status,
        start_date: r.start_date,
        end_date: r.end_date,
        days: r.days_requested,
        reason: r.reason ?? "",
        requester: r.requester?.name ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "type", header: "Type" },
        { key: "status", header: "Status" },
        { key: "start_date", header: "Start" },
        { key: "end_date", header: "End" },
        { key: "days", header: "Days" },
        { key: "reason", header: "Reason" },
        { key: "requester", header: "Requester" },
      ],
    );
  };

  const handleDelete = async (row: LeaveRequest) => {
    if (
      !(await confirm({
        title: "Delete draft",
        message: `Permanently remove draft ${row.reference_number}? This cannot be undone.`,
        confirmText: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setActionError(null);
    try {
      await leaveApi.delete(row.id);
      showToast("Draft deleted.");
      selection.clear();
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError("Failed to delete draft.");
    } finally {
      setActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: "Delete drafts",
        message: `Permanently delete ${ids.length} selected draft(s)? This cannot be undone.`,
        confirmText: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setActionError(null);
    try {
      await Promise.all(ids.map((id) => leaveApi.delete(id)));
      selection.clear();
      showToast("Selected drafts deleted.");
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError("Some deletions failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleWithdraw = async (row: LeaveRequest) => {
    if (
      !(await confirm({
        title: "Withdraw request",
        message: `Withdraw ${row.reference_number} from the approval workflow?`,
        confirmText: "Withdraw",
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setActionError(null);
    try {
      await leaveApi.withdraw(row.id);
      showToast("Request withdrawn.");
      await queryClient.invalidateQueries({ queryKey: ["leave", "list"] });
    } catch {
      setActionError("Failed to withdraw request.");
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <span className="text-neutral-700">Leave</span>
          </div>
          <h1 className="page-title">Leave Requests</h1>
          <p className="page-subtitle">Manage leave applications, balances, and LIL linkings.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export CSV
          </button>
          <Link href="/leave/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Request
          </Link>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{toast}</div>
      )}

      {(isError || actionError) && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{actionError ?? "Failed to load leave requests."}</span>
          {isError ? (
            <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
              Retry
            </button>
          ) : (
            <button type="button" className="text-xs font-semibold underline" onClick={() => setActionError(null)}>
              Dismiss
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {[
          {
            label: "Annual Leave",
            sub: "days remaining",
            value: balances ? `${balances.annual_balance_days}` : "—",
            icon: "event_available",
            color: "text-green-600",
            bg: "bg-green-50",
          },
          {
            label: "Leave in Lieu",
            sub: "hours available",
            value: balances ? `${balances.lil_hours_available}` : "—",
            icon: "schedule",
            color: "text-primary",
            bg: "bg-primary/10",
          },
          {
            label: "Sick Leave",
            sub: "days used",
            value: balances ? `${balances.sick_leave_used_days}` : "—",
            icon: "sick",
            color: "text-red-600",
            bg: "bg-red-50",
          },
          {
            label: "Special Leave",
            sub: "days used",
            value: balances ? `${balances.special_leave_days_used ?? 0}` : "—",
            icon: "star",
            color: "text-amber-600",
            bg: "bg-amber-50",
          },
          {
            label: "Maternity Leave",
            sub: "days used",
            value: balances ? `${balances.maternity_leave_days_used ?? 0}` : "—",
            icon: "pregnant_woman",
            color: "text-pink-600",
            bg: "bg-pink-50",
          },
          {
            label: "Paternity Leave",
            sub: "days used",
            value: balances ? `${balances.paternity_leave_days_used ?? 0}` : "—",
            icon: "man",
            color: "text-teal-600",
            bg: "bg-teal-50",
          },
        ].map((stat) => (
          <div key={stat.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-neutral-700">{stat.label}</p>
                <p className="mt-1 text-2xl font-bold text-neutral-900">{stat.value}</p>
                <p className="mt-0.5 text-[11px] text-neutral-400">{stat.sub}</p>
              </div>
              <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${stat.bg}`}>
                <span className={`material-symbols-outlined text-[20px] ${stat.color}`}>{stat.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, reason, type…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  selection.clear();
                  setPage(1);
                }}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={bulkLoading}>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkDelete()}
            className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            {bulkLoading ? "Deleting…" : "Delete selected"}
          </button>
        </BulkSelectionBar>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="space-y-3 p-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-neutral-100" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">event_available</span>
            <p className="text-sm font-semibold text-neutral-600">No leave requests found</p>
            <p className="mt-1 text-xs text-neutral-400">
              {filter === "all" && !search
                ? "Submit your first leave application."
                : "No rows match the current filters."}
            </p>
            <Link href="/leave/create" className="btn-primary mt-5 inline-flex text-sm">
              <span className="material-symbols-outlined text-[18px]">add</span>
              Apply for Leave
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th className="w-10">
                    <SelectAllCheckbox
                      checked={selection.allSelectableSelected}
                      indeterminate={selection.someSelectableSelected}
                      onChange={selection.toggleAllSelectable}
                      disabled={selection.selectableIds.length === 0 || bulkLoading}
                      label="Select all drafts"
                    />
                  </th>
                  <th>Reference</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {paged.map((req) => {
                  const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: "badge-muted" };
                  const busy = actionId === req.id;
                  const canDelete = req.status === "draft";
                  return (
                    <tr key={req.id} className={selection.isSelected(req.id) ? "bg-primary/5" : undefined}>
                      <td>
                        <RowCheckbox
                          checked={selection.isSelected(req.id)}
                          onChange={() => selection.toggle(req.id)}
                          disabled={!canDelete || bulkLoading}
                          title={canDelete ? undefined : "Only drafts can be deleted"}
                          label={`Select ${req.reference_number}`}
                        />
                      </td>
                      <td className="font-mono text-xs text-neutral-600">{req.reference_number}</td>
                      <td className="text-sm">{TYPE_LABELS[req.leave_type] ?? req.leave_type}</td>
                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDateShort(req.start_date)} → {formatDateShort(req.end_date)}
                      </td>
                      <td>{req.days_requested}</td>
                      <td className="max-w-[220px] truncate text-sm text-neutral-700">
                        {req.reason || "—"}
                      </td>
                      <td>
                        <span className={`badge text-xs ${s.cls}`}>{s.label}</span>
                      </td>
                      <td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/leave/${req.id}`} className="text-xs font-medium text-primary hover:underline">
                            View
                          </Link>
                          {canDelete && (
                            <>
                              <Link
                                href={`/leave/create?edit=${req.id}`}
                                className="text-xs font-medium text-neutral-600 hover:underline"
                              >
                                Edit
                              </Link>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void handleDelete(req)}
                                className="text-xs font-medium text-red-600 hover:underline disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </>
                          )}
                          {(req.status === "submitted" || req.status === "returned_for_correction") && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleWithdraw(req)}
                              className="text-xs font-medium text-amber-700 hover:underline disabled:opacity-50"
                            >
                              Withdraw
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <ListPagination
          page={Math.min(page, lastPage)}
          lastPage={lastPage}
          total={filtered.length}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
