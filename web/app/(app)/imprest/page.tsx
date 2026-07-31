"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { imprestApi, type ImprestRequest } from "@/lib/api";
import { useFormatDate } from "@/lib/useFormatDate";
import { exportToCsv } from "@/lib/csvExport";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { useToast } from "@/components/ui/Toast";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  approved: { label: "Approved", cls: "badge-success" },
  submitted: { label: "Submitted", cls: "badge-warning" },
  rejected: { label: "Rejected", cls: "badge-danger" },
  draft: { label: "Draft", cls: "badge-muted" },
  liquidated: { label: "Liquidated", cls: "badge-success" },
  withdrawn: { label: "Withdrawn", cls: "badge-muted" },
  returned_for_correction: { label: "Returned", cls: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "liquidated", label: "Liquidated" },
  { key: "returned_for_correction", label: "Returned" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function unwrapList(payload: unknown): ImprestRequest[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as { data?: unknown };
  const data = root.data ?? payload;
  if (Array.isArray(data)) return data as ImprestRequest[];
  if (data && typeof data === "object" && Array.isArray((data as { data?: unknown }).data)) {
    return (data as { data: ImprestRequest[] }).data;
  }
  return [];
}

export default function ImprestPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { fmt: formatDateShort } = useFormatDate();
  const { confirm } = useConfirm();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");


  const {
    data: requests = [],
    isLoading: loading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["imprest", "list"],
    queryFn: () => imprestApi.list({ per_page: 100 }).then((res) => unwrapList(res.data)),
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.purpose,
        row.budget_line,
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

  const pendingCount = requests.filter((r) => r.status === "submitted").length;
  const unliquidated = requests.filter(
    (r) => r.status === "approved" && (!r.amount_liquidated || r.amount_liquidated === 0),
  ).length;

  const getId = useCallback((row: ImprestRequest) => row.id, []);
  const canSelectDraft = useCallback((row: ImprestRequest) => row.status === "draft", []);
  const selection = useRowSelection({
    rows: filter === "draft" ? filtered : filtered.filter((r) => r.status === "draft"),
    getId,
    canSelect: canSelectDraft,
  });

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: "Delete drafts",
        message: `Permanently delete ${ids.length} selected draft(s)?`,
        confirmText: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => imprestApi.delete(id)));
      selection.clear();
      success("Selected drafts deleted.");
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError("Some deletions failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSubmit = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    setBulkLoading(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => imprestApi.submit(id)));
      selection.clear();
      success("Selected drafts submitted.");
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError("Some submissions failed.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (row: ImprestRequest) => {
    if (
      !(await confirm({
        title: "Delete draft",
        message: `Permanently remove draft ${row.reference_number}?`,
        confirmText: "Delete",
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setError(null);
    try {
      await imprestApi.delete(row.id);
      success("Draft deleted.");
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError("Failed to delete draft.");
    } finally {
      setActionId(null);
    }
  };

  const handleWithdraw = async (row: ImprestRequest) => {
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
    setError(null);
    try {
      await imprestApi.withdraw(row.id);
      success("Request withdrawn.");
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError("Failed to withdraw request.");
    } finally {
      setActionId(null);
    }
  };

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `imprest-requests-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        reference: r.reference_number,
        purpose: r.purpose,
        budget_line: r.budget_line,
        status: r.status,
        currency: r.currency,
        amount_requested: r.amount_requested,
        amount_approved: r.amount_approved ?? "",
        amount_liquidated: r.amount_liquidated ?? "",
        expected_liquidation_date: r.expected_liquidation_date,
        requester: r.requester?.name ?? "",
      })),
      [
        { key: "reference", header: "Reference" },
        { key: "purpose", header: "Purpose" },
        { key: "budget_line", header: "Budget line" },
        { key: "status", header: "Status" },
        { key: "currency", header: "Currency" },
        { key: "amount_requested", header: "Amount requested" },
        { key: "amount_approved", header: "Amount approved" },
        { key: "amount_liquidated", header: "Amount liquidated" },
        { key: "expected_liquidation_date", header: "Liquidate by" },
        { key: "requester", header: "Requester" },
      ],
    );
  };

  return (
    <RegisterShell
      title="Imprest Requests"
      subtitle="Manage petty cash requests and liquidations."
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <span className="text-neutral-700">Imprest</span>
        </div>
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, lastPage)}
      pageCount={lastPage}
      total={filtered.length}
      onPageChange={setPage}
      loading={loading}
      actions={
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
          <Link href="/imprest/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Request
          </Link>
        </div>
      }
      stats={
        <>
          {(isError || error) && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span className="material-symbols-outlined text-[16px]">error_outline</span>
              <span className="flex-1">{error ?? "Failed to load imprest requests."}</span>
              {isError ? (
                <button type="button" className="text-xs font-semibold underline" onClick={() => void refetch()}>
                  Retry
                </button>
              ) : (
                <button type="button" className="text-xs font-semibold underline" onClick={() => setError(null)}>
                  Dismiss
                </button>
              )}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: "Pending Approval",
                value: String(pendingCount),
                icon: "pending_actions",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                label: "Unliquidated",
                value: String(unliquidated),
                icon: "account_balance_wallet",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                label: "In register",
                value: String(requests.length),
                icon: "receipt_long",
                color: "text-neutral-600",
                bg: "bg-neutral-100",
              },
            ].map((stat) => (
              <div key={stat.label} className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-neutral-500">{stat.label}</p>
                    <p className="mt-1 text-xl font-bold text-neutral-900">{stat.value}</p>
                  </div>
                  <div className={"flex h-10 w-10 items-center justify-center rounded-xl " + stat.bg}>
                    <span className={"material-symbols-outlined text-[20px] " + stat.color}>{stat.icon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      }
      filters={
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder="Search reference, purpose, budget line…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label="Search imprest requests"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => {
                  setFilter(tab.key);
                  selection.clear();
                  setPage(1);
                }}
                className={"filter-tab " + (filter === tab.key ? "active" : "")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      }
      bulkBar={
        <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={bulkLoading}>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkSubmit()}
            className="inline-flex items-center gap-1 rounded-lg bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">send</span>
            Submit all
          </button>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Delete all
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && filtered.length === 0 ? (
          <div className="card overflow-hidden">
            <div className="px-5 py-16 text-center">
              <span className="material-symbols-outlined mb-2 block text-[40px] text-neutral-300">
                account_balance_wallet
              </span>
              <p className="text-sm font-semibold text-neutral-600">No imprest requests found</p>
              <p className="mt-1 text-xs text-neutral-400">
                {filter === "all" && !search
                  ? "Create a petty cash request to get started."
                  : "No rows match the current filters."}
              </p>
              <Link href="/imprest/create" className="btn-primary mt-5 inline-flex text-sm">
                <span className="material-symbols-outlined text-[18px]">add</span>
                New Imprest Request
              </Link>
            </div>
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <caption className="sr-only">Imprest requests register</caption>
            <thead>
              <tr>
                <th className={selectionColumnClass.th}>
                  <SelectAllCheckbox
                    checked={selection.allSelectableSelected}
                    indeterminate={
                      selection.someSelectableSelected && !selection.allSelectableSelected
                    }
                    onChange={selection.toggleAllSelectable}
                    disabled={selection.selectableIds.length === 0 || bulkLoading}
                    label="Select all drafts"
                  />
                </th>
                <th scope="col">Reference</th>
                <th scope="col">Purpose</th>
                <th scope="col">Budget</th>
                <th scope="col">Amount</th>
                <th scope="col">Liquidate by</th>
                <th scope="col">Status</th>
                <th scope="col"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((req) => {
                const s = STATUS_CONFIG[req.status] ?? { label: req.status, cls: "badge-muted" };
                const busy = actionId === req.id || bulkLoading;
                const needsRetire =
                  req.status === "approved" && (!req.amount_liquidated || req.amount_liquidated === 0);
                return (
                  <tr key={req.id} className={selection.isSelected(req.id) ? "bg-primary/5" : undefined}>
                    <td className={selectionColumnClass.td}>
                      <RowCheckbox
                        checked={selection.isSelected(req.id)}
                        onChange={() => selection.toggle(req.id)}
                        disabled={req.status !== "draft" || bulkLoading}
                        title={req.status === "draft" ? undefined : "Only drafts can be selected"}
                        label={"Select " + req.reference_number}
                      />
                    </td>
                    <td className="font-mono text-xs text-neutral-600">{req.reference_number}</td>
                    <td className="max-w-[200px] truncate font-medium text-neutral-900">{req.purpose}</td>
                    <td className="max-w-[140px] truncate text-xs text-neutral-600">{req.budget_line}</td>
                    <td className="whitespace-nowrap text-sm font-semibold">
                      {req.currency} {Number(req.amount_requested).toLocaleString()}
                    </td>
                    <td className="whitespace-nowrap text-xs text-neutral-500">
                      {formatDateShort(req.expected_liquidation_date)}
                    </td>
                    <td>
                      <span className={"badge text-xs " + s.cls}>{s.label}</span>
                    </td>
                    <td>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={"/imprest/" + req.id}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View
                        </Link>
                        {req.status === "draft" && (
                          <>
                            <Link
                              href={"/imprest/create?edit=" + req.id}
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
                        {needsRetire && (
                          <Link
                            href={"/imprest/" + req.id + "/liquidate"}
                            className="text-xs font-medium text-amber-600 hover:underline"
                          >
                            Retire
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
    </RegisterShell>
  );
}
