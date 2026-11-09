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
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  approved: { label: "status.approved", cls: "badge-success" },
  submitted: { label: "status.submitted", cls: "badge-warning" },
  rejected: { label: "status.rejected", cls: "badge-danger" },
  draft: { label: "status.draft", cls: "badge-muted" },
  liquidated: { label: "imprest.status.liquidated", cls: "badge-success" },
  withdrawn: { label: "imprest.status.withdrawn", cls: "badge-muted" },
  returned_for_correction: { label: "imprest.status.returned", cls: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "imprest.list.all" },
  { key: "draft", label: "status.draft" },
  { key: "submitted", label: "status.submitted" },
  { key: "approved", label: "status.approved" },
  { key: "liquidated", label: "imprest.status.liquidated" },
  { key: "returned_for_correction", label: "imprest.status.returned" },
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
  const { t } = useI18n();
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
        title: t("imprest.list.deleteDraftsTitle"),
        message: t("imprest.list.deleteDraftsMessage", { count: ids.length }),
        confirmText: t("common.delete"),
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
      success(t("imprest.list.draftsDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError(t("imprest.list.deletionsFailed"));
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
      success(t("imprest.list.draftsSubmitted"));
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError(t("imprest.list.submissionsFailed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const handleDelete = async (row: ImprestRequest) => {
    if (
      !(await confirm({
        title: t("imprest.list.deleteDraftTitle"),
        message: t("imprest.list.deleteDraftMessage", { ref: row.reference_number }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setError(null);
    try {
      await imprestApi.delete(row.id);
      success(t("imprest.list.draftDeleted"));
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError(t("imprest.list.deleteFailed"));
    } finally {
      setActionId(null);
    }
  };

  const handleWithdraw = async (row: ImprestRequest) => {
    if (
      !(await confirm({
        title: t("imprest.list.withdrawTitle"),
        message: t("imprest.list.withdrawMessage", { ref: row.reference_number }),
        confirmText: t("imprest.list.withdraw"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    setError(null);
    try {
      await imprestApi.withdraw(row.id);
      success(t("imprest.list.withdrawn"));
      await queryClient.invalidateQueries({ queryKey: ["imprest", "list"] });
    } catch {
      setError(t("imprest.list.withdrawFailed"));
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
        { key: "reference", header: t("correspondence.col.reference") },
        { key: "purpose", header: t("imprest.create.purposeLabel") },
        { key: "budget_line", header: t("imprest.list.budgetLine") },
        { key: "status", header: t("correspondence.col.status") },
        { key: "currency", header: t("imprest.create.currency") },
        { key: "amount_requested", header: t("imprest.list.amountRequested") },
        { key: "amount_approved", header: t("imprest.list.amountApproved") },
        { key: "amount_liquidated", header: t("imprest.list.amountLiquidated") },
        { key: "expected_liquidation_date", header: t("imprest.list.liquidateBy") },
        { key: "requester", header: t("imprest.certificate.requester") },
      ],
    );
  };

  return (
    <RegisterShell
      title={t("imprest.list.title")}
      subtitle={t("imprest.list.subtitle")}
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <span className="text-neutral-700">{t("nav.imprest")}</span>
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
            {t("correspondence.exportCsv")}
          </button>
          <Link href="/imprest/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("imprest.create.crumb")}
          </Link>
        </div>
      }
      stats={
        <>
          {(isError || error) && (
            <ErrorBanner
              message={error ?? t("imprest.list.loadFailed")}
              onRetry={isError ? () => void refetch() : undefined}
              onDismiss={isError ? undefined : () => setError(null)}
            />
          )}
          <div className="grid grid-cols-3 gap-4">
            {[
              {
                label: t("correspondence.status.pendingApproval"),
                value: String(pendingCount),
                icon: "pending_actions",
                color: "text-amber-600",
                bg: "bg-amber-50",
              },
              {
                label: t("imprest.list.unliquidated"),
                value: String(unliquidated),
                icon: "account_balance_wallet",
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                label: t("imprest.list.inRegister"),
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
              placeholder={t("imprest.list.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              aria-label={t("imprest.list.searchLabel")}
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
                {t(tab.label)}
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
            {t("imprest.list.submitAll")}
          </button>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            {t("imprest.list.deleteAll")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="account_balance_wallet"
              title={t("imprest.list.empty")}
              description={
                filter === "all" && !search
                  ? t("imprest.list.emptyHint")
                  : t("imprest.list.noMatch")
              }
              action={
                <Link href="/imprest/create" className="btn-primary inline-flex text-sm">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  {t("imprest.create.title")}
                </Link>
              }
            />
          </div>
        ) : undefined
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
            <caption className="sr-only">{t("imprest.list.caption")}</caption>
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
                    label={t("imprest.list.selectAllDrafts")}
                  />
                </th>
                <th scope="col">{t("correspondence.col.reference")}</th>
                <th scope="col">{t("imprest.create.purposeLabel")}</th>
                <th scope="col">{t("imprest.list.budget")}</th>
                <th scope="col">{t("imprest.list.amount")}</th>
                <th scope="col">{t("imprest.list.liquidateBy")}</th>
                <th scope="col">{t("correspondence.col.status")}</th>
                <th scope="col"><span className="sr-only">{t("correspondence.col.actions")}</span></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((req) => {
                const sc = STATUS_CONFIG[req.status];
                const s = sc ? { label: t(sc.label), cls: sc.cls } : { label: req.status, cls: "badge-muted" };
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
                        title={req.status === "draft" ? undefined : t("imprest.list.onlyDrafts")}
                        label={t("correspondence.selectRow", { ref: req.reference_number })}
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
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          {t("imprest.list.view")}
                        </Link>
                        {req.status === "draft" && (
                          <>
                            <Link
                              href={"/imprest/create?edit=" + req.id}
                              className="btn-secondary text-xs py-1 px-2"
                            >
                              {t("common.edit")}
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDelete(req)}
                              className="btn-secondary text-xs py-1 px-2 text-red-600 disabled:opacity-50"
                            >
                              {t("common.delete")}
                            </button>
                          </>
                        )}
                        {(req.status === "submitted" || req.status === "returned_for_correction") && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleWithdraw(req)}
                            className="btn-secondary text-xs py-1 px-2 text-amber-700 disabled:opacity-50"
                          >
                            {t("imprest.list.withdraw")}
                          </button>
                        )}
                        {needsRetire && (
                          <Link
                            href={"/imprest/" + req.id + "/liquidate"}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {t("imprest.list.retire")}
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
