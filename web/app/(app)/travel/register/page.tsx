"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { travelApi, type TravelRequest } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { formatCurrency, formatDateShort } from "@/lib/utils";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { getListData } from "@/lib/listPagination";

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

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "submitted", label: "Submitted" },
  { key: "approved", label: "Approved" },
  { key: "returned_for_correction", label: "Returned" },
  { key: "cancelled", label: "Cancelled" },
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
  const { confirm } = useConfirm();
  const user = getStoredUser();
  const admin = isSystemAdmin(user);
  const canExport =
    admin || hasPermission(user, ["travel.export", "travel.view", "travel.admin"]);

  const [rows, setRows] = useState<TravelRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);

  const [editRow, setEditRow] = useState<TravelRequest | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [cancelRow, setCancelRow] = useState<TravelRequest | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [cancelSaving, setCancelSaving] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 3200);
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await travelApi.list({ per_page: 100 });
      setRows(getListData<TravelRequest>(res.data));
    } catch {
      setError("Failed to load the travel register.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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

  const saveEdit = async () => {
    if (!editRow || !editForm) return;
    if (!editForm.purpose.trim() || !editForm.destination_country.trim()) {
      setEditError("Purpose and destination country are required.");
      return;
    }
    if (editForm.return_date < editForm.departure_date) {
      setEditError("Return date must be on or after departure.");
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
      showToast("Travel request updated.");
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
      const msg = apiMessage || fieldErrors || "Failed to update travel request.";
      setEditError(msg);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (row: TravelRequest) => {
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
    try {
      await travelApi.delete(row.id);
      showToast("Draft deleted.");
      await load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to delete draft.",
      );
    } finally {
      setActionId(null);
    }
  };

  const handleWithdraw = async (row: TravelRequest) => {
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
    try {
      await travelApi.withdraw(row.id);
      showToast("Request withdrawn.");
      await load();
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to withdraw request.",
      );
    } finally {
      setActionId(null);
    }
  };

  const saveCancel = async () => {
    if (!cancelRow) return;
    if (!cancelReason.trim()) {
      setCancelError("A cancellation reason is required.");
      return;
    }
    setCancelSaving(true);
    setCancelError(null);
    try {
      await travelApi.cancel(cancelRow.id, cancelReason.trim());
      setCancelRow(null);
      setCancelReason("");
      showToast("Travel request cancelled.");
      await load();
    } catch (err: unknown) {
      setCancelError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "Failed to cancel travel request.",
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
        showToast("No rows to export.");
        return;
      }
      downloadCsv(`travel-register-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(data));
      showToast(`Exported ${data.length} row(s).`);
    } catch {
      setError("Export failed. Check that you have travel.export or travel.view.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-neutral-500">
            <Link href="/travel" className="transition-colors hover:text-neutral-700">
              Travel
            </Link>
            <span className="material-symbols-outlined text-[14px]">chevron_right</span>
            <span className="text-neutral-700">Register</span>
          </div>
          <h1 className="page-title">Travel Register</h1>
          <p className="page-subtitle">
            Organisation-wide travel register with DSA totals, status filters, and row actions.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/travel/reports" className="btn-secondary text-sm">
            <span className="material-symbols-outlined text-[18px]">summarize</span>
            Reports
          </Link>
          {canExport && (
            <button
              type="button"
              className="btn-secondary text-sm disabled:opacity-50"
              disabled={exporting}
              onClick={() => void handleExport()}
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              {exporting ? "Exporting…" : "Export CSV"}
            </button>
          )}
          <Link href="/travel/create" className="btn-primary text-sm">
            <span className="material-symbols-outlined text-[18px]">add</span>
            New request
          </Link>
        </div>
      </div>

      {toast && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          {toast}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="text-xs font-semibold underline" onClick={() => setError(null)}>
            Dismiss
          </button>
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Register rows", value: stats.total, icon: "menu_book", color: "text-primary", bg: "bg-primary/10" },
            { label: "Approved", value: stats.approved, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
            { label: "Upcoming", value: stats.upcoming, icon: "flight_takeoff", color: "text-amber-600", bg: "bg-amber-50" },
            { label: "Drafts", value: stats.drafts, icon: "edit_note", color: "text-neutral-600", bg: "bg-neutral-100" },
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

      <div className="card flex flex-wrap items-end gap-3 p-3">
        <div className="min-w-[180px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-neutral-600">Search</label>
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2.5 text-[18px] text-neutral-400">
              search
            </span>
            <input
              className="form-input pl-8 text-sm"
              placeholder="Reference, purpose, traveller, destination…"
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
              onClick={() => setFilter(tab.key)}
              className={`filter-tab ${filter === tab.key ? "active" : ""}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="card space-y-3 p-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-lg bg-neutral-100" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card px-5 py-16 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <span className="material-symbols-outlined text-[28px] text-primary">flight</span>
          </div>
          <p className="text-sm font-semibold text-neutral-700">
            {rows.length === 0 ? "No travel register rows yet" : "No trips match your filters"}
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            {rows.length === 0
              ? "Approved and in-flight missions will appear here as requests are created."
              : "Try another status filter or clear the search."}
          </p>
          {rows.length > 0 ? (
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
            <Link href="/travel/create" className="btn-primary mt-5 inline-flex items-center gap-2 px-4 py-2 text-sm">
              <span className="material-symbols-outlined text-[16px]">add</span>
              New request
            </Link>
          )}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Traveller</th>
                  <th>Purpose / destination</th>
                  <th>Dates</th>
                  <th className="text-right">DSA</th>
                  <th>Status</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => {
                  const sc = STATUS_CONFIG[row.status] ?? { label: row.status, badge: "badge-muted" };
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
                    <tr key={row.id} className="align-top">
                      <td className="whitespace-nowrap font-mono text-xs text-neutral-600">
                        <Link href={`/travel/${row.id}`} className="font-semibold text-primary hover:underline">
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
                            aria-label={`View ${row.reference_number}`}
                            title="View"
                          >
                            <span className="material-symbols-outlined text-[18px]">visibility</span>
                          </Link>
                          {canEdit && (
                            <>
                              <Link
                                href={`/travel/create?edit=${row.id}`}
                                className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-primary/10 hover:text-primary"
                                aria-label={`Edit ${row.reference_number} in wizard`}
                                title="Edit in wizard"
                              >
                                <span className="material-symbols-outlined text-[18px]">edit_note</span>
                              </Link>
                              <button
                              type="button"
                              disabled={busy}
                              onClick={() => openEdit(row)}
                              className="rounded-lg p-2 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-800 disabled:opacity-40"
                              aria-label={`Quick edit ${row.reference_number}`}
                              title="Quick edit"
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
                              aria-label={`Delete ${row.reference_number}`}
                              title="Delete draft"
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
                              aria-label={`Withdraw ${row.reference_number}`}
                              title="Withdraw"
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
                              aria-label={`Cancel ${row.reference_number}`}
                              title="Cancel"
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
              Showing {filtered.length} of {rows.length} row(s)
            </span>
            <button type="button" className="font-medium text-primary hover:underline" onClick={() => void load()}>
              Refresh
            </button>
          </div>
        </div>
      )}

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
                Edit {editRow.reference_number}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Draft and returned requests only. Approved trips require an amendment from the detail page.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {editError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Purpose</label>
                <input
                  className="form-input text-sm"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-600">Country</label>
                  <input
                    className="form-input text-sm"
                    value={editForm.destination_country}
                    onChange={(e) => setEditForm({ ...editForm, destination_country: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-600">City</label>
                  <input
                    className="form-input text-sm"
                    value={editForm.destination_city}
                    onChange={(e) => setEditForm({ ...editForm, destination_city: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-600">Departure</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={editForm.departure_date}
                    onChange={(e) => setEditForm({ ...editForm, departure_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-600">Return</label>
                  <input
                    type="date"
                    className="form-input text-sm"
                    value={editForm.return_date}
                    onChange={(e) => setEditForm({ ...editForm, return_date: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Justification</label>
                <textarea
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
                Close
              </button>
              <Link href={`/travel/${editRow.id}`} className="btn-secondary text-sm">
                Open detail
              </Link>
              <button
                type="button"
                className="btn-primary text-sm disabled:opacity-50"
                disabled={editSaving}
                onClick={() => void saveEdit()}
              >
                {editSaving ? "Saving…" : "Save changes"}
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
                Cancel {cancelRow.reference_number}
              </h2>
              <p className="mt-0.5 text-xs text-neutral-500">
                Hard delete is only allowed for drafts. Cancelling releases any budget reservation and keeps an audit trail.
              </p>
            </div>
            <div className="space-y-3 px-5 py-4">
              {cancelError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {cancelError}
                </div>
              )}
              <div>
                <label className="mb-1 block text-xs font-semibold text-neutral-600">Reason</label>
                <textarea
                  className="form-input min-h-[96px] text-sm"
                  placeholder="Why is this trip being cancelled?"
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
                Close
              </button>
              <button
                type="button"
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                disabled={cancelSaving}
                onClick={() => void saveCancel()}
              >
                {cancelSaving ? "Cancelling…" : "Cancel trip"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
