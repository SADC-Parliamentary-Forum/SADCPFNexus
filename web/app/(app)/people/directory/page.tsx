"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { peopleAuthorityApi } from "@/lib/api";
import { getStoredUser, hasPermission, isSystemAdmin } from "@/lib/auth";
import { RegisterShell } from "@/components/registers/RegisterShell";
import { PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useToast } from "@/components/ui/Toast";
import { apiErrorMessage } from "@/lib/apiError";
import { EmptyState } from "@/components/ui/EmptyState";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormSection";
import { Modal } from "@/components/ui/Modal";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { DEFAULT_PAGE_SIZE, getListData, getLastPage, getTotal } from "@/lib/listPagination";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

type DirectoryPerson = {
  id?: number;
  first_name?: string;
  last_name?: string;
  display_name?: string | null;
  preferred_name?: string | null;
  email?: string | null;
  work_email?: string | null;
  employee_number?: string | null;
  person_number?: string | null;
  work_phone?: string | null;
  primary_unit_id?: number | null;
  department?: string | { id?: number; name?: string } | null;
  position?: string | { title?: string; name?: string } | null;
  status?: string | null;
  employment_status?: string | null;
  has_account?: boolean;
  deleted_at?: string | null;
};

type Unit = { id: number; name: string };

type StatusFilter = "" | "active" | "inactive";
type AccountFilter = "" | "linked" | "unlinked";

const emptyForm = {
  first_name: "",
  last_name: "",
  preferred_name: "",
  work_email: "",
  person_number: "",
  work_phone: "",
  employment_status: "active",
  primary_unit_id: "",
};

function displayName(p: DirectoryPerson, fallback: string): string {
  const preferred = p.preferred_name?.trim();
  if (preferred) return preferred;
  if (p.display_name?.trim()) return p.display_name.trim();
  return [p.first_name, p.last_name].filter(Boolean).join(" ") || fallback;
}

function deptLabel(p: DirectoryPerson): string {
  if (!p.department) return "-";
  if (typeof p.department === "string") return p.department;
  return p.department.name ?? "-";
}

function positionLabel(p: DirectoryPerson): string {
  if (!p.position) return "-";
  if (typeof p.position === "string") return p.position;
  return p.position.title ?? p.position.name ?? "-";
}

function emailOf(p: DirectoryPerson): string {
  return p.work_email ?? p.email ?? "-";
}

function numberOf(p: DirectoryPerson): string {
  return p.person_number ?? p.employee_number ?? "-";
}

function statusOf(p: DirectoryPerson): string {
  return p.employment_status ?? p.status ?? "";
}

export default function StaffDirectoryPage() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { confirm } = useConfirm();
  const toast = useToast();
  const [canManage, setCanManage] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [unitFilter, setUnitFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState<AccountFilter>("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  useEffect(() => {
    const me = getStoredUser();
    setCanManage(isSystemAdmin(me) || hasPermission(me, "people.manage"));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(timer);
  }, [q]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["people-authority", "staff-directory", debouncedQ, statusFilter, unitFilter, accountFilter, showDeleted, page],
    queryFn: async () => {
      return (
        await peopleAuthorityApi.listPeople({
          directory: true,
          page,
          per_page: DEFAULT_PAGE_SIZE,
          ...(debouncedQ ? { q: debouncedQ } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(unitFilter ? { unit_id: Number(unitFilter) } : {}),
          ...(accountFilter ? { account: accountFilter } : {}),
          ...(showDeleted ? { deleted: true } : {}),
        })
      ).data;
    },
    placeholderData: (previous) => previous,
  });

  const unitsQuery = useQuery({
    queryKey: ["people-authority", "units"],
    queryFn: async () => getListData<Unit>((await peopleAuthorityApi.listUnits({ per_page: 200 })).data),
    staleTime: 5 * 60 * 1000,
  });
  const units = unitsQuery.data ?? [];

  const rows = useMemo(() => getListData<DirectoryPerson>(data), [data]);
  const pageCount = useMemo(() => getLastPage(data), [data]);
  const total = useMemo(() => getTotal(data, rows.length), [data, rows.length]);
  const filtered = Boolean(debouncedQ || statusFilter || unitFilter || accountFilter);

  const getId = useCallback((p: DirectoryPerson) => p.id ?? -1, []);
  const canSelect = useCallback((p: DirectoryPerson) => canManage && p.id != null, [canManage]);
  const selection = useRowSelection({ rows, getId, canSelect });

  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when the visible set changes
  }, [page, debouncedQ, statusFilter, unitFilter, accountFilter, showDeleted]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["people-authority", "staff-directory"] });

  const payload = () => ({
    first_name: form.first_name.trim(),
    last_name: form.last_name.trim(),
    preferred_name: form.preferred_name.trim() || null,
    work_email: form.work_email.trim() || null,
    person_number: form.person_number.trim() || null,
    work_phone: form.work_phone.trim() || null,
    employment_status: form.employment_status || null,
    primary_unit_id: form.primary_unit_id ? Number(form.primary_unit_id) : null,
  });

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormErr(null);
  };

  const save = useMutation({
    mutationFn: () =>
      editingId ? peopleAuthorityApi.updatePerson(editingId, payload()) : peopleAuthorityApi.createPerson(payload()),
    onSuccess: () => {
      toast.success(editingId ? t("people.directory.updated") : t("people.directory.added"));
      closeForm();
      refresh();
    },
    onError: (e) => {
      const fallback = editingId ? t("people.directory.updateFailed") : t("people.directory.createFailed");
      const message = apiErrorMessage(e, fallback);
      setFormErr(message);
      toast.error(editingId ? t("people.directory.notUpdated") : t("people.directory.notAdded"), message);
    },
  });

  const sync = useMutation({
    mutationFn: () => peopleAuthorityApi.syncPeopleFromUsers(),
    onSuccess: (res) => {
      const { people_created, links_created } = res.data.data;
      const summary = t("people.directory.syncSummary", { created: people_created, linked: links_created });
      setSyncMessage(summary);
      toast.success(t("people.directory.populated"), summary);
      refresh();
    },
    onError: (e) => {
      toast.error(t("people.directory.notPopulated"), apiErrorMessage(e, t("people.directory.populateFailed")));
    },
  });

  const removeSuppliers = useMutation({
    mutationFn: () => peopleAuthorityApi.removeSupplierLinks(),
    onSuccess: (res) => {
      const { removed } = res.data.data;
      const summary =
        removed > 0
          ? t("people.directory.suppliersRemovedSummary", { count: removed })
          : t("people.directory.noSuppliersFound");
      setSyncMessage(summary);
      toast.success(t("people.directory.suppliersRemoved"), summary);
      refresh();
    },
    onError: (e) => {
      toast.error(t("people.directory.suppliersNotRemoved"), apiErrorMessage(e, t("people.directory.removeSuppliersFailed")));
    },
  });

  const bulkDelete = useMutation({
    mutationFn: (ids: number[]) => peopleAuthorityApi.bulkDeletePeople(ids),
    onSuccess: (res) => {
      const { deleted_count, skipped_count } = res.data.data;
      selection.clear();
      refresh();
      if (skipped_count > 0) {
        toast.success(
          t("people.directory.deletedSkipped", { done: deleted_count, skipped: skipped_count }),
          t("people.directory.deletedSkippedHint"),
        );
      } else {
        toast.success(t("people.directory.deletedCount", { count: deleted_count }));
      }
    },
    onError: (e) => {
      toast.error(t("people.directory.deleteFailed"), apiErrorMessage(e, t("people.directory.deleteFailed")));
    },
  });

  const bulkRestore = useMutation({
    mutationFn: (ids: number[]) => peopleAuthorityApi.bulkRestorePeople(ids),
    onSuccess: (res) => {
      selection.clear();
      refresh();
      toast.success(
        t("people.directory.restoredCount", { count: res.data.data.restored_count }),
        t("people.directory.restoredHint"),
      );
    },
    onError: (e) => {
      toast.error(t("people.directory.restoreFailed"), apiErrorMessage(e, t("people.directory.restoreFailed")));
    },
  });

  const busy = bulkDelete.isPending || bulkRestore.isPending;

  async function handleRemoveSuppliers() {
    const ok = await confirm({
      title: t("people.directory.removeSuppliersConfirmTitle"),
      message: t("people.directory.removeSuppliersConfirmMessage"),
      confirmText: t("people.directory.removeSuppliers"),
      variant: "danger",
    });
    if (ok) removeSuppliers.mutate();
  }

  async function handleDelete(ids: number[], name?: string) {
    if (ids.length === 0) return;
    const ok = await confirm({
      title: name ? t("people.directory.deleteOneTitle", { name }) : t("people.directory.deleteManyTitle", { count: ids.length }),
      message: t("people.directory.deleteMessage"),
      confirmText: t("people.directory.delete"),
      variant: "danger",
    });
    if (ok) bulkDelete.mutate(ids);
  }

  function selectedIds(): number[] {
    return selection.selectedIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormErr(null);
    setFormOpen(true);
  }

  function openEdit(p: DirectoryPerson) {
    if (!p.id || !canManage || showDeleted) return;
    const unitId =
      p.primary_unit_id ?? (p.department && typeof p.department === "object" ? p.department.id : undefined);
    setEditingId(p.id);
    setForm({
      first_name: p.first_name ?? "",
      last_name: p.last_name ?? "",
      preferred_name: p.preferred_name ?? "",
      work_email: p.work_email ?? p.email ?? "",
      person_number: p.person_number ?? p.employee_number ?? "",
      work_phone: p.work_phone ?? "",
      employment_status: statusOf(p) || "active",
      primary_unit_id: unitId ? String(unitId) : "",
    });
    setFormErr(null);
    setFormOpen(true);
  }

  function clearFilters() {
    setQ("");
    setStatusFilter("");
    setUnitFilter("");
    setAccountFilter("");
    setPage(1);
  }

  return (
    <RegisterShell
      title={t("people.authority.staffDirectory")}
      subtitle={t("people.directory.subtitle")}
      breadcrumbs={
        <PageBreadcrumbs
          items={[
            { label: t("people.hub.title"), href: "/people" },
            { label: t("people.authority.staffDirectory") },
          ]}
        />
      }
      actions={
        <>
          {canManage && (
            <button type="button" className="btn-primary text-sm" onClick={openCreate}>
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              {t("people.directory.addPerson")}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => sync.mutate()}
              disabled={sync.isPending}
              title={t("people.directory.populateHint")}
            >
              {sync.isPending ? t("people.directory.populating") : t("people.directory.populate")}
            </button>
          )}
          {canManage && (
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={handleRemoveSuppliers}
              disabled={removeSuppliers.isPending}
              title={t("people.directory.removeSuppliersHint")}
            >
              {removeSuppliers.isPending ? t("people.directory.removing") : t("people.directory.removeSuppliers")}
            </button>
          )}
          <Link href="/organogram" className="btn-secondary text-sm">
            {t("people.directory.orgChart")}
          </Link>
          <Link href="/profile" className="btn-secondary text-sm">
            {t("people.directory.myProfile")}
          </Link>
        </>
      }
      filters={
        <div className="space-y-3">
          {canManage && (
            <div className="flex flex-wrap gap-2" role="tablist" aria-label={t("people.directory.viewLabel")}>
              {([false, true] as const).map((deleted) => (
                <button
                  key={String(deleted)}
                  type="button"
                  role="tab"
                  aria-selected={showDeleted === deleted}
                  onClick={() => {
                    setShowDeleted(deleted);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    showDeleted === deleted ? "bg-primary text-white" : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                  }`}
                >
                  {deleted ? t("people.directory.viewDeleted") : t("people.directory.viewCurrent")}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap items-end gap-3">
            <label htmlFor="people-directory-search" className="block min-w-[220px] flex-1 text-xs font-medium text-neutral-600">
              {t("common.search")}
              <input
                id="people-directory-search"
                className="form-input mt-1"
                placeholder={t("people.directory.searchPlaceholder")}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label htmlFor="people-directory-status" className="block text-xs font-medium text-neutral-600">
              {t("people.common.status")}
              <select
                id="people-directory-status"
                className="form-input mt-1"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as StatusFilter);
                  setPage(1);
                }}
              >
                <option value="">{t("people.directory.allStatuses")}</option>
                <option value="active">{t("people.directory.statusActive")}</option>
                <option value="inactive">{t("people.directory.statusInactive")}</option>
              </select>
            </label>
            <label htmlFor="people-directory-unit" className="block text-xs font-medium text-neutral-600">
              {t("people.directory.department")}
              <select
                id="people-directory-unit"
                className="form-input mt-1"
                value={unitFilter}
                onChange={(e) => {
                  setUnitFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="">{t("people.directory.allDepartments")}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor="people-directory-account" className="block text-xs font-medium text-neutral-600">
              {t("people.directory.loginAccount")}
              <select
                id="people-directory-account"
                className="form-input mt-1"
                value={accountFilter}
                onChange={(e) => {
                  setAccountFilter(e.target.value as AccountFilter);
                  setPage(1);
                }}
              >
                <option value="">{t("people.directory.anyAccount")}</option>
                <option value="linked">{t("people.directory.withAccount")}</option>
                <option value="unlinked">{t("people.directory.withoutAccount")}</option>
              </select>
            </label>
            {filtered && (
              <button type="button" className="btn-secondary text-sm" onClick={clearFilters}>
                {t("people.directory.clearFilters")}
              </button>
            )}
          </div>
          {canManage && (
            <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={busy}>
              {showDeleted ? (
                <button
                  type="button"
                  disabled={busy || selection.selectedCount === 0}
                  onClick={() => bulkRestore.mutate(selectedIds())}
                  className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">restore</span>
                  {bulkRestore.isPending ? t("people.directory.restoring") : t("people.directory.restoreSelected")}
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy || selection.selectedCount === 0}
                  onClick={() => void handleDelete(selectedIds())}
                  className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  {bulkDelete.isPending ? t("people.directory.deleting") : t("people.directory.deleteSelected")}
                </button>
              )}
            </BulkSelectionBar>
          )}
        </div>
      }
      loading={isLoading}
      page={page}
      pageCount={pageCount}
      total={total}
      onPageChange={setPage}
      empty={
        !isLoading && (isError || rows.length === 0)
          ? isError
            ? (
                <EmptyState
                  icon="error"
                  title={t("people.directory.loadErrorTitle")}
                  description={t("people.directory.loadError")}
                  action={
                    <button type="button" className="btn-primary text-sm" onClick={() => refetch()}>
                      {t("common.retry")}
                    </button>
                  }
                />
              )
            : showDeleted
              ? (
                  <EmptyState
                    icon="delete"
                    title={t("people.directory.noDeletedTitle")}
                    description={t("people.directory.noDeletedHint")}
                  />
                )
              : (
                  <EmptyState
                    icon="contacts"
                    title={filtered ? t("people.directory.noMatches") : t("people.directory.emptyTitle")}
                    description={filtered ? t("people.directory.noMatchesHint") : t("people.directory.emptyHint")}
                    action={
                      filtered ? (
                        <button type="button" className="btn-secondary text-sm" onClick={clearFilters}>
                          {t("people.directory.clearFilters")}
                        </button>
                      ) : canManage ? (
                        <button type="button" className="btn-primary text-sm" onClick={() => sync.mutate()} disabled={sync.isPending}>
                          {sync.isPending ? t("people.directory.populating") : t("people.directory.populate")}
                        </button>
                      ) : undefined
                    }
                  />
                )
          : undefined
      }
    >
      {syncMessage && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800" role="status">
          <span>{syncMessage}</span>
          <button
            type="button"
            className="text-green-700 hover:text-green-900"
            onClick={() => setSyncMessage(null)}
            aria-label={t("people.directory.dismiss")}
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="data-table">
              <caption className="sr-only">{t("people.authority.staffDirectory")}</caption>
              <thead>
                <tr>
                  {canManage && (
                    <th className={selectionColumnClass.th}>
                      <SelectAllCheckbox
                        checked={selection.allSelectableSelected}
                        indeterminate={selection.someSelectableSelected && !selection.allSelectableSelected}
                        onChange={selection.toggleAllSelectable}
                        disabled={selection.selectableIds.length === 0 || busy}
                      />
                    </th>
                  )}
                  <th>{t("people.common.name")}</th>
                  <th>{t("people.directory.employeeNo")}</th>
                  <th className="hidden md:table-cell">{t("people.directory.department")}</th>
                  <th className="hidden lg:table-cell">{t("people.common.position")}</th>
                  <th className="hidden sm:table-cell">{t("people.directory.email")}</th>
                  <th>{showDeleted ? t("people.directory.deletedOn") : t("people.common.status")}</th>
                  <th className="hidden md:table-cell">{t("people.directory.loginAccount")}</th>
                  {canManage && <th className="text-right">{t("people.directory.actions")}</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p, idx) => {
                  const name = displayName(p, t("people.directory.personFallback", { id: p.id ?? "-" }));
                  const status = statusOf(p);
                  const editable = canManage && !showDeleted && p.id != null;
                  return (
                    <tr
                      key={p.id ?? idx}
                      className={`${editable ? "cursor-pointer" : ""} ${p.id != null && selection.isSelected(p.id) ? "bg-primary/5" : ""}`}
                      onClick={() => openEdit(p)}
                    >
                      {canManage && (
                        <td className={selectionColumnClass.td} onClick={(e) => e.stopPropagation()}>
                          <RowCheckbox
                            checked={p.id != null && selection.isSelected(p.id)}
                            onChange={() => p.id != null && selection.toggle(p.id)}
                            disabled={p.id == null || busy}
                            label={t("people.directory.selectName", { name })}
                          />
                        </td>
                      )}
                      <td className="font-medium text-neutral-800">{name}</td>
                      <td>{numberOf(p)}</td>
                      <td className="hidden md:table-cell">{deptLabel(p)}</td>
                      <td className="hidden lg:table-cell">{positionLabel(p)}</td>
                      <td className="hidden sm:table-cell text-neutral-600">{emailOf(p)}</td>
                      <td>
                        {showDeleted ? (
                          <span className="text-neutral-600">{p.deleted_at ? formatDateShort(p.deleted_at) : "-"}</span>
                        ) : (
                          <span className={`badge capitalize ${status === "active" ? "badge-success" : "badge-muted"}`}>
                            {status === "active"
                              ? t("people.directory.statusActive")
                              : status === "inactive"
                                ? t("people.directory.statusInactive")
                                : status || "-"}
                          </span>
                        )}
                      </td>
                      <td className="hidden md:table-cell">
                        {p.has_account ? (
                          <span className="badge badge-info">{t("people.directory.linked")}</span>
                        ) : (
                          <span className="badge badge-muted">{t("people.directory.noAccount")}</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="inline-flex items-center gap-1">
                            {showDeleted ? (
                              <button
                                type="button"
                                className="rounded-lg p-1.5 text-primary hover:bg-primary/10 disabled:opacity-50"
                                onClick={() => p.id != null && bulkRestore.mutate([p.id])}
                                disabled={busy || p.id == null}
                                title={t("people.directory.restore")}
                                aria-label={t("people.directory.restoreName", { name })}
                              >
                                <span className="material-symbols-outlined text-[18px]">restore</span>
                              </button>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-800"
                                  onClick={() => openEdit(p)}
                                  title={t("people.directory.edit")}
                                  aria-label={t("people.directory.editName", { name })}
                                >
                                  <span className="material-symbols-outlined text-[18px]">edit</span>
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg p-1.5 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:opacity-50"
                                  onClick={() => p.id != null && void handleDelete([p.id], name)}
                                  disabled={busy || p.id == null}
                                  title={t("people.directory.delete")}
                                  aria-label={t("people.directory.deleteName", { name })}
                                >
                                  <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {showDeleted && (
            <p className="border-t border-neutral-100 px-4 py-3 text-xs text-neutral-500">
              {t("people.directory.deletedFooter")}
            </p>
          )}
        </div>
      ) : null}

      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        title={editingId ? t("people.directory.editTitle") : t("people.directory.addTitle")}
        description={editingId ? undefined : t("people.directory.addDescription")}
        footer={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" className="btn-secondary text-sm" onClick={closeForm}>
              {t("common.cancel")}
            </button>
            <button type="submit" form="people-directory-form" className="btn-primary text-sm" disabled={save.isPending}>
              {save.isPending
                ? t("people.common.saving")
                : editingId
                  ? t("people.directory.saveChanges")
                  : t("people.directory.addPerson")}
            </button>
          </div>
        }
      >
        <form
          id="people-directory-form"
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.first_name.trim() || !form.last_name.trim()) {
              setFormErr(t("people.directory.namesRequired"));
              return;
            }
            save.mutate();
          }}
        >
          <FormField label={t("people.directory.firstName")} htmlFor="dir-first-name" required>
            <input
              id="dir-first-name"
              className="form-input"
              value={form.first_name}
              onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label={t("people.directory.lastName")} htmlFor="dir-last-name" required>
            <input
              id="dir-last-name"
              className="form-input"
              value={form.last_name}
              onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))}
              required
            />
          </FormField>
          <FormField label={t("people.directory.preferredName")} htmlFor="dir-preferred-name">
            <input
              id="dir-preferred-name"
              className="form-input"
              value={form.preferred_name}
              onChange={(e) => setForm((f) => ({ ...f, preferred_name: e.target.value }))}
            />
          </FormField>
          <FormField label={t("people.directory.employeeNumber")} htmlFor="dir-person-number">
            <input
              id="dir-person-number"
              className="form-input"
              value={form.person_number}
              onChange={(e) => setForm((f) => ({ ...f, person_number: e.target.value }))}
            />
          </FormField>
          <FormField label={t("people.directory.workEmail")} htmlFor="dir-work-email">
            <input
              id="dir-work-email"
              type="email"
              className="form-input"
              value={form.work_email}
              onChange={(e) => setForm((f) => ({ ...f, work_email: e.target.value }))}
            />
          </FormField>
          <FormField label={t("people.directory.workPhone")} htmlFor="dir-work-phone">
            <input
              id="dir-work-phone"
              className="form-input"
              value={form.work_phone}
              onChange={(e) => setForm((f) => ({ ...f, work_phone: e.target.value }))}
            />
          </FormField>
          <FormField label={t("people.directory.department")} htmlFor="dir-unit">
            <select
              id="dir-unit"
              className="form-input"
              value={form.primary_unit_id}
              onChange={(e) => setForm((f) => ({ ...f, primary_unit_id: e.target.value }))}
            >
              <option value="">{t("people.directory.noDepartment")}</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label={t("people.common.status")} htmlFor="dir-status">
            <select
              id="dir-status"
              className="form-input"
              value={form.employment_status}
              onChange={(e) => setForm((f) => ({ ...f, employment_status: e.target.value }))}
            >
              <option value="active">{t("people.directory.statusActive")}</option>
              <option value="inactive">{t("people.directory.statusInactive")}</option>
              {form.employment_status && !["active", "inactive"].includes(form.employment_status) && (
                <option value={form.employment_status}>{form.employment_status}</option>
              )}
            </select>
          </FormField>
          {formErr && <p className="text-sm text-red-700 sm:col-span-2">{formErr}</p>}
        </form>
      </Modal>
    </RegisterShell>
  );
}
