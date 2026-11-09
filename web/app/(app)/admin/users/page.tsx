"use client";

import { ModulePageHeader, PageBreadcrumbs } from "@/components/ui/ModulePageHeader";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { adminApi, type User } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import {
  BulkSelectionBar,
  RowCheckbox,
  SelectAllCheckbox,
  selectionColumnClass,
} from "@/components/ui/BulkSelectionBar";
import { useRowSelection } from "@/lib/useRowSelection";
import { useToast } from "@/components/ui/Toast";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiErrorMessage } from "@/lib/apiError";
import { invitationState } from "@/lib/userInvitation";
import { formatDateShort } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/LocaleProvider";

const classColors: Record<string, string> = {
  UNCLASSIFIED: "badge-muted",
  RESTRICTED: "badge-warning",
  CONFIDENTIAL: "badge-warning",
  SECRET: "badge-danger",
};

const ADMIN_ROLE_NAMES = new Set([
  "System Admin",
  "System Administrator",
  "super-admin",
  "admin",
  "Admin",
]);

function roleNames(user: User): string[] {
  if (!Array.isArray(user.roles)) return [];
  return user.roles
    .map((r) => (typeof r === "string" ? r : (r as { name?: string })?.name))
    .filter((n): n is string => Boolean(n));
}

function isProtectedUser(user: User, currentUserId: number | null): { ok: false; reason: string } | { ok: true } {
  if (currentUserId != null && user.id === currentUserId) {
    return { ok: false, reason: "admin.users.reason.self" };
  }
  if (roleNames(user).some((r) => ADMIN_ROLE_NAMES.has(r))) {
    return { ok: false, reason: "admin.users.reason.sysAdmin" };
  }
  if (!user.is_active) {
    return { ok: false, reason: "admin.users.reason.inactive" };
  }
  return { ok: true };
}

/** Translated status label and invitation action for a user row. */
function invitationText(
  inv: ReturnType<typeof invitationState>,
  t: (key: string) => string,
): { label: string; action: string | null } {
  const action = inv.action
    ? t(inv.kind === "not_invited" ? "admin.users.inv.send" : "admin.users.inv.resend")
    : null;
  switch (inv.kind) {
    case "expired":
      return { label: t("admin.users.inv.expired"), action };
    case "sent":
      return { label: t("admin.users.inv.sent"), action };
    case "not_invited":
      return { label: t("admin.users.inv.notInvited"), action };
    case "active":
      return { label: t("admin.common.active"), action };
    default:
      return { label: inv.label === "Inactive" ? t("admin.common.inactive") : inv.label, action };
  }
}

export default function AdminUsersPage() {
  const { t } = useI18n();
  const { success, error: showErrorToast, info } = useToast();
  const { confirm } = useConfirm();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "invited" | "inactive">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const getId = useCallback((u: User) => u.id, []);
  const canSelect = useCallback(
    (u: User) => isAdmin && isProtectedUser(u, currentUserId).ok,
    [isAdmin, currentUserId],
  );

  const selection = useRowSelection({
    rows: users,
    getId,
    canSelect,
  });

  useEffect(() => {
    const me = getStoredUser();
    setIsAdmin(isSystemAdmin(me));
    setCurrentUserId(me?.id ?? null);
  }, []);

  const reload = useCallback(() => {
    setLoading(true);
    const params: Record<string, string | number> = { page, per_page: 15 };
    if (search) params.search = search;
    if (statusFilter !== "all") params.status = statusFilter;
    adminApi
      .listUsers(params)
      .then((res) => {
        setUsers((res.data as { data?: User[] }).data ?? []);
        setTotal(res.data.total ?? 0);
      })
      .catch(() => setError(t("admin.users.loadFailed")))
      .finally(() => setLoading(false));
  }, [page, search, statusFilter, t]);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    selection.clear();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset selection when the page set changes
  }, [page, search, statusFilter]);


  const handleDeactivate = async (user: User) => {
    const gate = isProtectedUser(user, currentUserId);
    if (!gate.ok) {
      setError(t(gate.reason));
      return;
    }
    if (
      !(await confirm({
        title: t("admin.users.deactivateTitle"),
        message: t("admin.users.deactivateMessage", { name: user.name }),
        confirmText: t("admin.users.deactivate"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setActionLoading(user.id);
    setError(null);
    try {
      await adminApi.deactivateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: false } : u)));
      selection.clear();
      success(t("admin.users.deactivated"));
    } catch {
      setError(t("admin.users.deactivateFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleInvite = async (user: User) => {
    const resend = invitationState(user).kind !== "not_invited";
    setActionLoading(user.id);
    try {
      const res = await adminApi.resendUserInvitation(user.id);
      const updated = res.data.user;
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, latest_account_invitation: updated.latest_account_invitation } : u)));
      success(resend ? t("admin.users.inv.resentToast") : t("admin.users.inv.sent"), t("admin.users.inv.canRegister", { email: user.email }));
    } catch (err) {
      showErrorToast(t("admin.users.inv.notSent"), apiErrorMessage(err, t("admin.users.inv.sendFailed")));
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivate = async (user: User) => {
    if (user.is_active) return;
    setActionLoading(user.id);
    setError(null);
    try {
      await adminApi.reactivateUser(user.id);
      setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, is_active: true } : u)));
      success(t("admin.users.reactivated"));
    } catch {
      setError(t("admin.users.reactivateFailed"));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkDeactivate = async () => {
    const ids = selection.selectedIds.map(Number).filter((id) => Number.isFinite(id));
    if (ids.length === 0) return;
    if (
      !(await confirm({
        title: t("admin.users.bulkTitle"),
        message: t("admin.users.bulkMessage", { count: ids.length }),
        confirmText: t("admin.users.deactivate"),
        variant: "danger",
      }))
    ) {
      return;
    }
    setBulkLoading(true);
    setError(null);
    try {
      const res = await adminApi.bulkDeactivateUsers(ids);
      const { deactivated_count, skipped_count } = res.data;
      selection.clear();
      reload();
      if (skipped_count > 0) {
        success(t("admin.users.bulkDoneSkipped", { done: deactivated_count, skipped: skipped_count }));
      } else {
        success(t("admin.users.bulkDone", { count: deactivated_count }));
      }
    } catch {
      setError(t("admin.users.bulkFailed"));
    } finally {
      setBulkLoading(false);
    }
  };

  const activeCount = useMemo(() => users.filter((u) => u.is_active).length, [users]);
  const lastPage = Math.ceil(total / 15) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <ModulePageHeader
        title={t("admin.home.userManagement")}
        subtitle={t("admin.users.subtitle")}
        breadcrumbs={<PageBreadcrumbs items={[{ label: t("admin.home.userManagement") }]} />}
      />
        {isAdmin && (
          <Link href="/admin/users/create" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            {t("admin.users.add")}
          </Link>
        )}
      </div>
{error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px]">error_outline</span>
          <span className="flex-1">{error}</span>
          <button type="button" className="btn-secondary text-xs" onClick={() => setError(null)}>
            {t("admin.users.dismiss")}
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: t("admin.weeklySummary.totalUsers"), value: total, icon: "people", color: "text-primary", bg: "bg-primary/10" },
          { label: t("admin.common.active"), value: activeCount, icon: "check_circle", color: "text-green-600", bg: "bg-green-50" },
          {
            label: t("admin.common.inactive"),
            value: Math.max(0, total - activeCount),
            icon: "block",
            color: "text-red-500",
            bg: "bg-red-50",
          },
          {
            label: t("admin.users.mfaEnabled"),
            value: users.filter((u) => u.mfa_enabled).length,
            icon: "security",
            color: "text-primary",
            bg: "bg-primary/10",
          },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-neutral-500">{s.label}</p>
                <p className="text-2xl font-bold text-neutral-900 mt-0.5">{s.value}</p>
              </div>
              <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center`}>
                <span className={`material-symbols-outlined ${s.color} text-[20px]`}>{s.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="card p-4">
        <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <div className="flex gap-2 flex-wrap">
            {(["all", "active", "invited", "inactive"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => {
                  setStatusFilter(f);
                  setPage(1);
                }}
                className={`filter-tab capitalize ${statusFilter === f ? "active" : ""}`}
              >
                {t(`admin.users.filter.${f}`)}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 text-[18px]">
              search
            </span>
            <input
              className="form-input pl-9"
              placeholder={t("admin.users.search")}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
        {isAdmin && (
          <BulkSelectionBar count={selection.selectedCount} onClear={selection.clear} disabled={bulkLoading}>
            <button
              type="button"
              disabled={bulkLoading || selection.selectedCount === 0}
              onClick={() => void handleBulkDeactivate()}
              className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[14px]">person_off</span>
              {bulkLoading ? t("admin.users.deactivating") : t("admin.users.deactivateSelected")}
            </button>
          </BulkSelectionBar>
        )}
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-400">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              <span className="text-sm">{t("common.loading")}</span>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
              <caption className="sr-only">{t("admin.users.caption")}</caption>
                <thead>
                  <tr>
                    {isAdmin && (
                      <th className={selectionColumnClass.th}>
                        <SelectAllCheckbox
                          checked={selection.allSelectableSelected}
                          indeterminate={
                            selection.someSelectableSelected && !selection.allSelectableSelected
                          }
                          onChange={selection.toggleAllSelectable}
                          disabled={selection.selectableIds.length === 0 || bulkLoading}
                        />
                      </th>
                    )}
                    <th>{t("admin.common.user")}</th>
                    <th className="hidden md:table-cell">{t("admin.common.department")}</th>
                    <th className="hidden lg:table-cell">{t("admin.users.classification")}</th>
                    <th>{t("admin.common.status")}</th>
                    <th className="hidden sm:table-cell">{"MFA"}</th>
                    {isAdmin && <th className="text-right">{t("admin.common.actions")}</th>}
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const gate = isProtectedUser(user, currentUserId);
                    const gateReason = !gate.ok ? t(gate.reason) : undefined;
                    const selectable = isAdmin && gate.ok;
                    const invText = invitationText(invitationState(user), t);
                    return (
                      <tr
                        key={user.id}
                        className={selection.isSelected(user.id) ? "bg-primary/5" : undefined}
                      >
                        {isAdmin && (
                          <td className={selectionColumnClass.td}>
                            <RowCheckbox
                              checked={selection.isSelected(user.id)}
                              onChange={() => selection.toggle(user.id)}
                              disabled={!selectable || bulkLoading}
                              title={gateReason}
                              label={t("admin.users.selectName", { name: user.name })}
                            />
                          </td>
                        )}
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <span className="text-xs font-bold text-primary">
                                {user.name
                                  .split(" ")
                                  .map((n) => n[0])
                                  .join("")
                                  .slice(0, 2)}
                              </span>
                            </div>
                            <div>
                              <p className="font-semibold text-neutral-900 text-sm">{user.name}</p>
                              <p className="text-xs text-neutral-400">
                                {user.email}
                                {user.employee_number ? ` · ${user.employee_number}` : ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="hidden md:table-cell">
                          <p className="text-sm text-neutral-700">{user.department?.name ?? "—"}</p>
                          <p className="text-xs text-neutral-400">{user.job_title ?? ""}</p>
                        </td>
                        <td className="hidden lg:table-cell">
                          <span className={`badge ${classColors[user.classification] ?? "badge-muted"}`}>
                            {user.classification}
                          </span>
                        </td>
                        <td>
                          {(() => {
                            const inv = invitationState(user);
                            return (
                              <>
                                <span className={`badge ${inv.badge}`} data-testid={`user-status-${user.id}`}>{invText.label}</span>
                                {inv.kind === "sent" && inv.expiresAt && (
                                  <p className="text-[11px] text-neutral-400 mt-0.5">{t("admin.users.expires", { date: formatDateShort(inv.expiresAt) })}</p>
                                )}
                              </>
                            );
                          })()}
                        </td>
                        <td className="hidden sm:table-cell">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              user.mfa_enabled ? "text-green-600" : "text-neutral-400"
                            }`}
                          >
                            <span className="material-symbols-outlined text-[14px]">
                              {user.mfa_enabled ? "verified_user" : "security"}
                            </span>
                            {user.mfa_enabled ? t("admin.users.mfaOn") : t("admin.users.mfaOff")}
                          </span>
                        </td>
                        {isAdmin && (
                          <td>
                            <div className="flex items-center justify-end gap-3">
                              <Link
                                href={`/admin/users/${user.id}`}
                                className="btn-secondary text-xs py-1 px-2"
                              >
                                {t("common.edit")}
                              </Link>
                              {invitationState(user).action ? (
                                <button
                                  type="button"
                                  onClick={() => void handleInvite(user)}
                                  disabled={actionLoading === user.id}
                                  className="btn-secondary text-xs py-1 px-2 text-primary disabled:opacity-50"
                                  data-testid={`user-invite-${user.id}`}
                                >
                                  {actionLoading === user.id ? "…" : invText.action}
                                </button>
                              ) : user.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => void handleDeactivate(user)}
                                  disabled={actionLoading === user.id || !gate.ok}
                                  title={gateReason}
                                  className="btn-secondary text-xs py-1 px-2 text-red-600 disabled:opacity-50"
                                >
                                  {actionLoading === user.id ? "…" : t("admin.users.deactivate")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => void handleReactivate(user)}
                                  disabled={actionLoading === user.id}
                                  className="btn-secondary text-xs py-1 px-2 text-green-700 disabled:opacity-50"
                                >
                                  {actionLoading === user.id ? "…" : t("admin.users.reactivate")}
                                </button>
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

            {users.length === 0 && (
              <EmptyState
                icon="person_search"
                title={t("admin.users.empty")}
                description={t("admin.users.emptyDesc")}
              />
            )}

            <div className="border-t border-neutral-100 px-5 py-3 flex items-center justify-between">
              <p className="text-xs text-neutral-400">
                {t("admin.users.countOf", { shown: users.length, total })}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                >
                  {t("admin.users.prev")}
                </button>
                <span className="px-3 py-1.5 text-xs text-neutral-600 font-medium">
                  {t("common.pageOf", { page, total: lastPage })}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                  disabled={page >= lastPage}
                  className="btn-secondary py-1.5 px-3 text-xs disabled:opacity-40"
                >
                  {t("admin.users.next")}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
