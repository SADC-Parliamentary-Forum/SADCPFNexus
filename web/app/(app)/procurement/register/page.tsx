"use client";

import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { procurementApi, type ProcurementRequest } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";
import { exportToCsv } from "@/lib/csvExport";
import { DEFAULT_PAGE_SIZE, clientPageCount, slicePage } from "@/lib/listPagination";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useRowSelection } from "@/lib/useRowSelection";
import {
  PROCUREMENT_EXPORT_COLUMNS,
  buildProcurementExportRows,
  draftIdsForBulkCancel,
  selectedProcurementRows,
} from "@/lib/procurementRegisterBulk";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  draft: { label: "status.draft", badge: "badge-muted" },
  submitted: { label: "status.submitted", badge: "badge-warning" },
  approved: { label: "status.approved", badge: "badge-success" },
  rejected: { label: "status.rejected", badge: "badge-danger" },
  cancelled: { label: "status.cancelled", badge: "badge-muted" },
  awarded: { label: "procurement.status.awarded", badge: "badge-success" },
  in_progress: { label: "procurement.status.inProgress", badge: "badge-primary" },
  completed: { label: "procurement.status.completed", badge: "badge-success" },
  returned_for_correction: { label: "procurement.status.returned", badge: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "procurement.filter.all" },
  { key: "draft", label: "status.draft" },
  { key: "submitted", label: "status.submitted" },
  { key: "approved", label: "status.approved" },
  { key: "awarded", label: "procurement.status.awarded" },
  { key: "completed", label: "procurement.status.completed" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function getListData(payload: unknown): ProcurementRequest[] {
  if (Array.isArray(payload)) return payload as ProcurementRequest[];
  if (payload && typeof payload === "object" && "data" in payload) {
    const nested = (payload as { data?: unknown }).data;
    if (Array.isArray(nested)) return nested as ProcurementRequest[];
  }
  return [];
}

export default function ProcurementRegisterPage() {
  const { success, error, info } = useToast();
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const { t } = useI18n();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [bulkError, setBulkError] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["procurement", "register"],
    queryFn: () => procurementApi.list({ per_page: 500 }).then((res) => getListData(res.data)),
    staleTime: 30_000,
  });

  const rows = useMemo(() => data ?? [], [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.title,
        row.category,
        row.procurement_method,
        row.status,
        row.budget_line,
        row.programme?.reference_number,
        row.requester?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, search]);

  const pageCount = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const paged = useMemo(
    () => slicePage(filtered, Math.min(page, pageCount), DEFAULT_PAGE_SIZE),
    [filtered, page, pageCount],
  );

  const getId = useCallback((row: ProcurementRequest) => row.id, []);
  const selection = useRowSelection({
    rows: paged,
    getId,
  });

  const stats = useMemo(
    () => ({
      total: rows.length,
      submitted: rows.filter((r) => r.status === "submitted").length,
      approved: rows.filter((r) => r.status === "approved" || r.status === "awarded").length,
      drafts: rows.filter((r) => r.status === "draft").length,
    }),
    [rows],
  );

  const exportColumns = [...PROCUREMENT_EXPORT_COLUMNS];

  const handleExport = () => {
    if (filtered.length === 0) return;
    exportToCsv(
      `procurement-register-${new Date().toISOString().slice(0, 10)}.csv`,
      buildProcurementExportRows(filtered),
      exportColumns,
    );
  };

  const handleExportSelected = () => {
    const selected = selectedProcurementRows(filtered, selection.selectedIds);
    if (selected.length === 0) return;
    exportToCsv(
      `procurement-register-selected-${new Date().toISOString().slice(0, 10)}.csv`,
      buildProcurementExportRows(selected),
      exportColumns,
    );
  };

  const cancelMut = useMutation({
    mutationFn: async (ids: number[]) => {
      const results = await Promise.allSettled(ids.map((id) => procurementApi.delete(id)));
      return results;
    },
    onSuccess: (results) => {
      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;
      error(fail ? t("procurement.register.cancelPartial", { ok, fail }) : t("procurement.register.cancelDone", { count: ok }));
      selection.clear();
      void qc.invalidateQueries({ queryKey: ["procurement", "register"] });
    },
    onError: () => setBulkError(t("procurement.tenders.bulkFailed")),
    onSettled: () => setBulkLoading(false),
  });

  const handleBulkCancelDrafts = async () => {
    const ids = draftIdsForBulkCancel(filtered, selection.selectedIds);
    if (ids.length === 0) {
      setBulkError(t("procurement.register.selectDraft"));
      return;
    }
    if (
      !(await confirm({
        title: t("procurement.register.confirmTitle"),
        message: t("procurement.register.confirmMessage", { count: ids.length }),
        confirmText: t("procurement.register.confirmButton"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setBulkError(null);
    
    cancelMut.mutate(ids);
  };

  return (
    <RegisterShell
      title={t("procurement.register.title")}
      subtitle={t("procurement.register.subtitle")}
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Link href="/procurement" className="transition-colors hover:text-neutral-700">
            {t("nav.procurement")}
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">{t("procurement.register.crumb")}</span>
        </div>
      }
      actions={
        <>
          <button
            type="button"
            className="btn-secondary text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={handleExport}
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            {t("procurement.exportCsv")}
          </button>
          <Link href="/procurement/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("procurement.register.newRequest")}
          </Link>
        </>
      }
      density={density}
      onDensityChange={setDensity}
      page={Math.min(page, pageCount)}
      pageCount={pageCount}
      total={filtered.length}
      onPageChange={(p) => {
        setPage(p);
        selection.clear();
      }}
      loading={isLoading}
      stats={
        <>
{bulkError || isError ? (
            <ErrorBanner
              message={bulkError ?? t("procurement.register.loadError")}
              onRetry={isError ? () => void refetch() : undefined}
            />
          ) : null}
          {!isLoading && rows.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("procurement.register.kpi.rows"), value: stats.total, icon: "menu_book", color: "text-primary", bg: "bg-primary/10" },
                { label: t("status.submitted"), value: stats.submitted, icon: "pending_actions", color: "text-amber-600", bg: "bg-amber-50" },
                { label: t("procurement.register.kpi.approvedAwarded"), value: stats.approved, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
                { label: t("procurement.intake.kpi.drafts"), value: stats.drafts, icon: "edit_note", color: "text-neutral-600", bg: "bg-neutral-100" },
              ].map((s) => (
                <div key={s.label} className="card p-4">
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
          ) : null}
        </>
      }
      filters={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-neutral-400">
              search
            </span>
            <input
              type="search"
              className="form-input pl-10"
              placeholder={t("procurement.register.searchPlaceholder")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
                selection.clear();
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
                  setPage(1);
                  selection.clear();
                }}
                className={`filter-tab ${filter === tab.key ? "active" : ""}`}
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
            className="btn-secondary text-xs"
            disabled={selection.selectedCount === 0 || bulkLoading}
            onClick={handleExportSelected}
          >
            {t("procurement.register.exportSelected")}
          </button>
          <button
            type="button"
            disabled={bulkLoading}
            onClick={() => void handleBulkCancelDrafts()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            {bulkLoading ? t("procurement.tenders.cancelling") : t("procurement.register.cancelSelected")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !isLoading && filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="shopping_cart"
              title={t("procurement.index.empty")}
              description={
                rows.length === 0
                  ? t("procurement.register.emptyNone")
                  : t("procurement.register.emptyFiltered")
              }
            />
          </div>
        ) : null
      }
    >
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="data-table w-full">
              <caption className="sr-only">{t("procurement.register.caption")}</caption>
            <thead>
              <tr>
                <th className={selectionColumnClass.th}>
                  <SelectAllCheckbox
                    checked={selection.allSelectableSelected}
                    indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                    onChange={selection.toggleAllSelectable}
                  />
                </th>
                <th>{t("procurement.col.reference")}</th>
                <th>{t("procurement.col.title")}</th>
                <th>{t("procurement.certificate.category")}</th>
                <th>{t("procurement.col.method")}</th>
                <th>{t("procurement.col.status")}</th>
                <th>{t("procurement.col.value")}</th>
                <th>PIF</th>{/* i18n-ignore */}
                <th>{t("procurement.col.submitted")}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => {
                const sc = STATUS_CONFIG[row.status] ?? {
                  label: "",
                  badge: "badge-muted",
                };
                const statusLabel = sc.label ? t(sc.label) : row.status.replace(/_/g, " ");
                return (
                  <tr key={row.id}>
                    <td className={selectionColumnClass.td}>
                      <RowCheckbox
                        checked={selection.isSelected(row.id)}
                        onChange={() => selection.toggle(row.id)}
                        label={t("procurement.selectRow", { ref: row.reference_number })}
                      />
                    </td>
                    <td className="font-mono text-xs">{row.reference_number}</td>
                    <td className="max-w-xs truncate font-medium">{row.title}</td>
                    <td className="text-xs capitalize">{row.category}</td>
                    <td className="text-xs">{row.procurement_method}</td>
                    <td>
                      <span className={`badge text-xs capitalize ${sc.badge}`}>{statusLabel}</span>
                    </td>
                    <td className="whitespace-nowrap font-mono text-sm">
                      {row.currency} {Number(row.estimated_value ?? 0).toLocaleString()}
                    </td>
                    <td className="font-mono text-xs">{row.programme?.reference_number ?? "—"}</td>
                    <td className="text-xs text-neutral-500">
                      {row.submitted_at ? formatDateShort(row.submitted_at) : "—"}
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={`/procurement/${row.id}`}
                          className="btn-secondary text-xs py-1 px-2"
                        >
                          {t("procurement.view")}
                        </Link>
                        {row.status === "draft" && (
                          <Link
                            href={`/procurement/${row.id}`}
                            className="btn-secondary text-xs py-1 px-2"
                          >
                            {t("common.edit")}
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
