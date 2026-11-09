"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelDestinationCountry, type TravelRequest } from "@/lib/api";
import { TravelDestinationFields } from "@/components/travel/DestinationPickers";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getListData } from "@/lib/listPagination";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { RegisterShell, type RegisterDensity } from "@/components/registers/RegisterShell";
import { clientPageCount, DEFAULT_PAGE_SIZE, slicePage } from "@/lib/listPagination";
import { useToast } from "@/components/ui/Toast";
import { EmptyState, ErrorBanner } from "@/components/ui/EmptyState";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  approved: { label: "travel.hub.status.approved", badge: "badge-success" },
  submitted: { label: "travel.hub.status.submitted", badge: "badge-warning" },
  resubmitted: { label: "travel.register.status.resubmitted", badge: "badge-warning" },
  rejected: { label: "travel.hub.status.rejected", badge: "badge-danger" },
  draft: { label: "travel.hub.status.draft", badge: "badge-muted" },
  cancelled: { label: "travel.hub.status.cancelled", badge: "badge-muted" },
  withdrawn: { label: "travel.register.status.withdrawn", badge: "badge-muted" },
  returned_for_correction: { label: "travel.hub.status.returned", badge: "badge-warning" },
  amendment_pending: { label: "travel.register.status.amendment", badge: "badge-warning" },
};

const FILTER_TABS = [
  { key: "all", label: "travel.hub.filter.all" },
  { key: "draft", label: "travel.hub.status.draft" },
  { key: "submitted", label: "travel.hub.status.submitted" },
  { key: "approved", label: "travel.hub.status.approved" },
  { key: "returned_for_correction", label: "travel.hub.status.returned" },
  { key: "cancelled", label: "travel.hub.status.cancelled" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

type EditForm = {
  purpose: string;
  destination_country: string;
  destination_city: string;
  departure_date: string;
  return_date: string;
  justification: string;
};

function destinationOf(row: TravelRequest): string {
  return [row.destination_city, row.destination_country].filter(Boolean).join(", ") || row.destination_country || "—";
}

function dsaOf(row: TravelRequest): number {
  return Number(row.finance_dsa_total ?? row.actual_dsa ?? row.estimated_dsa ?? 0);
}

function canMutateRow(row: TravelRequest, userId: number | undefined, admin: boolean): boolean {
  if (admin) return true;
  if (!userId) return false;
  if (row.requester?.id === userId) return true;
  if (row.prepared_by === userId) return true;
  if (row.prepared_on_behalf_of === userId) return true;
  return false;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const keys = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  return [keys.join(","), ...rows.map((r) => keys.map((k) => escape(r[k])).join(","))].join("\n");
}

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function TravelRegisterPage() {
  const { success, error: showErrorToast, info } = useToast();
  const { confirm } = useConfirm();
  const { t } = useI18n();
  const user = getStoredUser();
  const admin = isSystemAdmin(user);
  const canExport =
    admin || hasPermission(user, ["travel.export", "travel.view", "travel.admin"]);

  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [density, setDensity] = useState<RegisterDensity>("comfortable");
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  const [editRow, setEditRow] = useState<TravelRequest | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [destinations, setDestinations] = useState<TravelDestinationCountry[]>([]);
  const [addingDestination, setAddingDestination] = useState(false);

  const [cancelRow, setCancelRow] = useState<TravelRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);


  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.list({ per_page: 100 });
      setRows(getListData<TravelRequest>(res.data));
    } catch {
      setError(t("travel.register.loadFailed"));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    travelApi
      .listDestinations()
      .then((r) => setDestinations(r.data.data?.countries ?? []))
      .catch(() => setDestinations([]));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (filter !== "all" && row.status !== filter) return false;
      if (!q) return true;
      const hay = [
        row.reference_number,
        row.purpose,
        row.destination_country,
        row.destination_city,
        row.requester?.name,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filter, search]);

  const pageCount = clientPageCount(filtered.length, DEFAULT_PAGE_SIZE);
  const pageRows = useMemo(
    () => slicePage(filtered, page, DEFAULT_PAGE_SIZE),
    [filtered, page],
  );

  const getId = useCallback((row: TravelRequest) => row.id, []);
  const canSelectRow = useCallback(
    (row: TravelRequest) =>
      row.status === "draft" && canMutateRow(row, user?.id, admin),
    [user?.id, admin],
  );
  const selection = useRowSelection({
    rows: pageRows,
    getId,
    canSelect: canSelectRow,
  });

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      total: rows.length,
      approved: rows.filter((r) => r.status === "approved").length,
      upcoming: rows.filter((r) => r.status === "approved" && r.departure_date > today).length,
      drafts: rows.filter((r) => r.status === "draft").length,
    };
  }, [rows]);

  const openEdit = (row: TravelRequest) => {
    setEditRow(row);
    setEditError(null);
    setEditForm({
      purpose: row.purpose ?? "",
      destination_country: row.destination_country ?? "",
      destination_city: row.destination_city ?? "",
      departure_date: String(row.departure_date ?? "").slice(0, 10),
      return_date: String(row.return_date ?? "").slice(0, 10),
      justification: row.justification ?? "",
    });
  };

  const handleAddCountry = async (name: string) => {
    if (!editForm) return;
    setAddingDestination(true);
    try {
      const res = await travelApi.createCountry({ name });
      const list = await travelApi.listDestinations();
      setDestinations(list.data.data?.countries ?? []);
      setEditForm({ ...editForm, destination_country: res.data.data.name, destination_city: "" });
    } finally {
      setAddingDestination(false);
    }
  };

  const handleAddCity = async (country: string, name: string) => {
    if (!editForm) return;
    setAddingDestination(true);
    try {
      const res = await travelApi.createCity({ country, name });
      const list = await travelApi.listDestinations();
      setDestinations(list.data.data?.countries ?? []);
      setEditForm({
        ...editForm,
        destination_country: res.data.data.country,
        destination_city: res.data.data.name,
      });
    } finally {
      setAddingDestination(false);
    }
  };

  const saveEdit = async () => {
    if (!editRow || !editForm) return;
    if (!editForm.purpose.trim() || !editForm.destination_country.trim()) {
      setEditError(t("travel.register.err.required"));
      return;
    }
    if (editForm.return_date < editForm.departure_date) {
      setEditError(t("travel.register.err.returnDate"));
      return;
    }
    setEditSaving(true);
    setEditError(null);
    try {
      await travelApi.update(editRow.id, {
        purpose: editForm.purpose.trim(),
        destination_country: editForm.destination_country.trim(),
        destination_city: editForm.destination_city.trim() || null,
        departure_date: editForm.departure_date,
        return_date: editForm.return_date,
        justification: editForm.justification.trim() || null,
      });
      setEditRow(null);
      setEditForm(null);
      success(t("travel.register.ok.updated"));
      await load();
    } catch (err: unknown) {
      const apiMessage =
        (err as { response?: { data?: { message?: string; errors?: Record<string, string[]> } } })
          ?.response?.data?.message;
      const fieldErrors = Object.values(
        (err as { response?: { data?: { errors?: Record<string, string[]> } } })?.response?.data
          ?.errors ?? {},
      )
        .flat()
        .join(" ");
      const msg = apiMessage || fieldErrors || t("travel.register.err.update");
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (row: TravelRequest) => {
    if (
      !(await confirm({
        title: t("travel.register.deleteDraft"),
        message: t("travel.register.deleteDraftMessage", { ref: row.reference_number }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    try {
      await travelApi.delete(row.id);
      success(t("travel.register.ok.draftDeleted"));
      selection.clear();
      await load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("travel.register.err.delete"),
      );
    } finally {
      setActionId(null);
    }
  };

  const handleBulkDelete = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: t("travel.register.deleteDrafts"),
        message: t("travel.register.deleteDraftsMessage", { count: ids.length }),
        confirmText: t("common.delete"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setError(null);
    try {
      await Promise.all(ids.map((id) => travelApi.delete(id)));
      selection.clear();
      success(t("travel.register.ok.draftsDeleted"));
      await load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("travel.register.err.bulkDelete"),
      );
    } finally {
      setBulkLoading(false);
    }
  };

  const handleWithdraw = async (row: TravelRequest) => {
    if (
      !(await confirm({
        title: t("travel.register.withdrawTitle"),
        message: t("travel.register.withdrawMessage", { ref: row.reference_number }),
        confirmText: t("travel.register.withdraw"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionId(row.id);
    try {
      await travelApi.withdraw(row.id);
      success(t("travel.register.ok.withdrawn"));
      await load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("travel.register.err.withdraw"),
      );
    } finally {
      setActionId(null);
    }
  };

  const saveCancel = async () => {
    if (!cancelRow) return;
    if (!cancelReason.trim()) {
      setCancelError(t("travel.register.err.cancelReason"));
      return;
    }
    setCancelSaving(true);
    setCancelError(null);
    try {
      await travelApi.cancel(cancelRow.id, cancelReason.trim());
      setCancelRow(null);
      setCancelReason("");
      success(t("travel.register.ok.cancelled"));
      await load();
    } catch (err: unknown) {
      setCancelError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          t("travel.register.err.cancel"),
      );
    } finally {
      setCancelSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const params: Record<string, string> = {};
      if (filter !== "all") params.status = filter;
      if (search.trim()) params.search = search.trim();
      const res = await travelApi.registerExport(params);
      const data = res.data.data ?? [];
      if (!data.length) {
        success(t("travel.register.noRowsToExport"));
        return;
      }
      downloadCsv(`travel-register-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
      success(t("travel.register.exported", { count: data.length }));
    } catch {
      setError(t("travel.register.err.export"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
    <RegisterShell
      title={t("travel.register.title")}
      subtitle={t("travel.register.subtitle")}
      breadcrumbs={
        <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
          <Link href="/travel" className="transition-colors hover:text-neutral-700">
            {t("nav.travel")}
          </Link>
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
          <span className="text-neutral-700">{t("travel.register.crumb")}</span>
        </div>
      }
      actions={
        <>
          <Link href="/travel/reports" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            {t("travel.register.reports")}
          </Link>
          {canExport && (
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-50"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {exporting ? t("travel.register.exporting") : t("travel.register.exportCsv")}
            </button>
          )}
          <Link href="/travel/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("travel.hub.newRequest")}
          </Link>
        </>
      }
      density={density}
      onDensityChange={setDensity}
      page={page}
      pageCount={pageCount}
      total={filtered.length}
      onPageChange={(p) => {
        setPage(p);
        selection.clear();
      }}
      loading={loading}
      stats={
        <>
{error && (
            <ErrorBanner message={error} onDismiss={() => setError(null)} />
          )}
          {!loading && rows.length > 0 && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t("travel.register.stat.rows"), value: stats.total, icon: "menu_book", color: "text-primary", bg: "bg-primary/10" },
                { label: t("travel.hub.status.approved"), value: stats.approved, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
                { label: t("travel.hub.stat.upcoming"), value: stats.upcoming, icon: "flight_takeoff", color: "text-amber-600", bg: "bg-amber-50" },
                { label: t("travel.hub.stat.drafts"), value: stats.drafts, icon: "edit_note", color: "text-neutral-600", bg: "bg-neutral-100" },
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
          )}
        </>
      }
      filters={
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[180px] flex-1">
            <label htmlFor="travel-register-search" className="mb-1 block text-xs font-semibold text-neutral-600">{t("common.search")}</label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-neutral-400">
                search
              </span>
              <input
                id="travel-register-search"
                className="form-input pl-8 text-sm"
                placeholder={t("travel.register.searchPlaceholder")}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 pb-0.5">
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
            disabled={bulkLoading}
            onClick={() => void handleBulkDelete()}
            className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            {bulkLoading ? t("travel.register.deleting") : t("travel.register.deleteSelected")}
          </button>
        </BulkSelectionBar>
      }
      empty={
        !loading && filtered.length === 0 ? (
          <div className="card">
            <EmptyState
              icon="flight"
              title={rows.length === 0 ? t("travel.register.empty.none") : t("travel.register.empty.filtered")}
              description={
                rows.length === 0
                  ? t("travel.register.empty.noneHint")
                  : t("travel.register.empty.filteredHint")
              }
            />
          </div>
        ) : undefined
      }
    >
      {!loading && filtered.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <caption className="sr-only">{t("travel.register.caption")}</caption>
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
                      label={t("travel.register.selectAll")}
                    />
                  </th>
                  <th>{t("travel.register.col.reference")}</th>
                  <th>{t("travel.register.col.traveller")}</th>
                  <th>{t("travel.register.col.purpose")}</th>
                  <th>{t("travel.register.col.dates")}</th>
                  <th className="text-right">{t("travel.register.col.dsa")}</th>
                  <th>{t("travel.register.col.status")}</th>
                  <th className="text-right">{t("travel.register.col.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => {
                  const scConfig = STATUS_CONFIG[row.status];
                  const sc = scConfig
                    ? { label: t(scConfig.label), badge: scConfig.badge }
                    : { label: row.status, badge: "badge-muted" };
                  const mutable = canMutateRow(row, user?.id, admin);
                  const canEdit =
                    mutable && (row.status === "draft" || row.status === "returned_for_correction");
                  const canDelete = mutable && row.status === "draft";
                  const canWithdraw = mutable && row.status === "submitted";
                  const canCancel =
                    mutable &&
                    !["draft", "cancelled", "withdrawn"].includes(row.status) &&
                    row.status !== "submitted";
                  const busy = actionId === row.id;

                  return (
                    <tr
                      key={row.id}
                      className={`align-top ${selection.isSelected(row.id) ? "bg-primary/5" : ""}`}
                    >
                      <td className={selectionColumnClass.td}>
                        <RowCheckbox
                          checked={selection.isSelected(row.id)}
                          onChange={() => selection.toggle(row.id)}
                          disabled={!canDelete || bulkLoading}
                          title={canDelete ? undefined : t("travel.register.onlyDrafts")}
                          label={t("travel.register.selectRow", { ref: row.reference_number })}
                        />
                      </td>
                      <td className="whitespace-nowrap font-mono text-xs text-neutral-600">
                        <Link href={`/travel/${row.id}`} className="font-semibold text-primary">
                          {row.reference_number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-sm font-medium text-neutral-900">
                        {row.requester?.name ?? "—"}
                      </td>
                      <td className="max-w-[280px]">
                        <p className="truncate text-sm font-medium text-neutral-900" title={row.purpose}>
                          {row.purpose}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-neutral-500">
                          <span className="material-symbols-outlined text-[14px]">place</span>
                          {destinationOf(row)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-xs text-neutral-600">
                        {formatDateShort(row.departure_date)} → {formatDateShort(row.return_date)}
                      </td>
                      <td className="whitespace-nowrap text-right text-sm font-semibold text-neutral-900">
                        {formatCurrency(dsaOf(row), row.currency || "NAD")}
                      </td>
                      <td>
                        <span className={`badge text-xs ${sc.badge}`}>{sc.label}</span>
                      </td>
                      <td>
                        <div className="flex items-center justify-end gap-0.5">
                          <Link
                            href={`/travel/${row.id}`}
                            className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-primary/10 hover:text-primary"
                            aria-label={t("travel.register.viewRow", { ref: row.reference_number })}
                            title={t("travel.register.view")}
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </Link>
                          {canEdit && (
                            <>
                              <Link
                                href={`/travel/create?edit=${row.id}`}
                                className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-primary/10 hover:text-primary"
                                aria-label={t("travel.register.editWizardRow", { ref: row.reference_number })}
                                title={t("travel.register.editWizard")}
                              >
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                              </Link>
                              <button
                              type="button"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
                              aria-label={t("travel.register.quickEditRow", { ref: row.reference_number })}
                              title={t("travel.register.quickEdit")}
                            >
                              <span className="material-symbols-outlined text-[18px]">edit</span>
                            </button>
                            </>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleDelete(row)}
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              aria-label={t("travel.register.deleteRow", { ref: row.reference_number })}
                              title={t("travel.register.deleteDraft")}
                            >
                              <span className="material-symbols-outlined text-[18px]">delete</span>
                            </button>
                          )}
                          {canWithdraw && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void handleWithdraw(row)}
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-amber-50 hover:text-amber-700 disabled:opacity-40"
                              aria-label={t("travel.register.withdrawRow", { ref: row.reference_number })}
                              title={t("travel.register.withdraw")}
                            >
                              <span className="material-symbols-outlined text-[18px]">block</span>
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => {
                                setCancelRow(row);
                                setCancelReason("");
                                setCancelError(null);
                              }}
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                              aria-label={t("travel.register.cancelRow", { ref: row.reference_number })}
                              title={t("common.cancel")}
                            >
                              <span className="material-symbols-outlined text-[18px]">cancel</span>
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
          <div className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
            <span>
              {t("travel.register.showing", { shown: pageRows.length, total: filtered.length })}
            </span>
            <button type="button" className="btn-secondary text-xs py-1 px-2" onClick={() => void load()}>
              {t("travel.register.refresh")}
            </button>
          </div>
        </div>
      )}
    </RegisterShell>

      {editRow && editForm && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="travel-register-edit-title"
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 id="travel-register-edit-title" className="text-lg font-semibold text-neutral-900">
                {t("travel.register.editTitle", { ref: editRow.reference_number })}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {t("travel.register.editHint")}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {editError}
                </div>
              )}
              <div>
                <label htmlFor="travel-register-purpose" className="mb-1 block text-xs font-semibold text-neutral-600">{t("travel.register.purpose")}</label>
                <input id="travel-register-purpose"
                  className="form-input text-sm"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                />
              </div>
              <TravelDestinationFields
                  country={editForm.destination_country}
                  city={editForm.destination_city}
                  countries={destinations}
                  adding={addingDestination}
                  onCountryChange={(v) => setEditForm({ ...editForm, destination_country: v })}
                  onCityChange={(v) => setEditForm({ ...editForm, destination_city: v })}
                  onAddCountry={handleAddCountry}
                  onAddCity={handleAddCity}
                />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="travel-register-departure" className="mb-1 block text-xs font-semibold text-neutral-600">{t("travel.register.departure")}</label>
                  <input id="travel-register-departure"
                    type="date"
                    className="form-input text-sm"
                    value={editForm.departure_date}
                    onChange={(e) => setEditForm({ ...editForm, departure_date: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="travel-register-return" className="mb-1 block text-xs font-semibold text-neutral-600">{t("travel.register.return")}</label>
                  <input id="travel-register-return"
                    type="date"
                    className="form-input text-sm"
                    value={editForm.return_date}
                    onChange={(e) => setEditForm({ ...editForm, return_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="travel-register-justification" className="mb-1 block text-xs font-semibold text-neutral-600">{t("travel.register.justification")}</label>
                <textarea id="travel-register-justification"
                  className="form-input min-h-[80px] text-sm"
                  value={editForm.justification}
                  onChange={(e) => setEditForm({ ...editForm, justification: e.target.value })}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={editSaving}
                onClick={() => {
                  setEditRow(null);
                  setEditForm(null);
                }}
              >
                {t("common.close")}
              </button>
              <Link href={`/travel/${editRow.id}`} className="btn-secondary text-sm">
                {t("travel.register.openDetail")}
              </Link>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={editSaving}
                onClick={() => void saveEdit()}
              >
                {editSaving ? t("travel.register.saving") : t("travel.register.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelRow && (
        <div className="fixed inset-0 z-[180] flex items-center justify-center bg-black/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="travel-register-cancel-title"
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <div className="border-b border-neutral-100 px-5 py-4">
              <h2 id="travel-register-cancel-title" className="text-lg font-semibold text-neutral-900">
                {t("travel.register.cancelTitle", { ref: cancelRow.reference_number })}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                {t("travel.register.cancelHint")}
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {cancelError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {cancelError}
                </div>
              )}
              <div>
                <label htmlFor="travel-register-reason" className="mb-1 block text-xs font-semibold text-neutral-600">{t("common.reason")}</label>
                <textarea id="travel-register-reason"
                  className="form-input min-h-[96px] text-sm"
                  placeholder={t("travel.register.cancelPlaceholder")}
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50 px-5 py-3">
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={cancelSaving}
                onClick={() => setCancelRow(null)}
              >
                {t("common.close")}
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={cancelSaving}
                onClick={() => void saveCancel()}
              >
                {cancelSaving ? t("travel.register.cancelling") : t("travel.register.cancelTrip")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
