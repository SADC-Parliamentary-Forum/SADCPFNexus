"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { adminApi, type Role } from "@/lib/api";
import { getStoredUser, isSystemAdmin } from "@/lib/auth";
import { useConfirm } from "@/components/ui/ConfirmDialog";

const PROTECTED_NAMES = ["System Admin", "System Administrator", "super-admin"];

const MODULE_GROUPS = [
  { label: "Travel",       icon: "flight",               color: "blue",   perms: ["travel.view","travel.create","travel.approve","travel.admin"] },
  { label: "Leave",        icon: "event_available",      color: "emerald",perms: ["leave.view","leave.create","leave.approve","leave.admin"] },
  { label: "Imprest",      icon: "payments",             color: "amber",  perms: ["imprest.view","imprest.create","imprest.approve","imprest.liquidate"] },
  { label: "Finance",      icon: "account_balance",      color: "violet", perms: ["finance.view","finance.create","finance.approve","finance.export","finance.admin"] },
  { label: "Procurement",  icon: "shopping_cart",        color: "orange", perms: ["procurement.view","procurement.create","procurement.approve","procurement.admin"] },
  { label: "Assets",       icon: "inventory_2",          color: "teal",   perms: ["assets.view","assets.create","assets.edit","assets.dispose","assets.admin","assets.manage"] },
  { label: "Governance",   icon: "gavel",                color: "purple", perms: ["governance.view","governance.create","governance.approve","governance.admin"] },
  { label: "HR",           icon: "people",               color: "pink",   perms: ["hr.view","hr.create","hr.edit","hr.approve","hr.admin"] },
  { label: "Timesheets",   icon: "schedule",             color: "rose",   perms: ["timesheets.view","timesheets.create","timesheets.approve"] },
  { label: "Appraisals",   icon: "star_rate",            color: "yellow", perms: ["appraisals.view","appraisals.create","appraisals.review","appraisals.admin"] },
  { label: "Conduct",      icon: "policy",               color: "red",    perms: ["conduct.view","conduct.create","conduct.admin"] },
  { label: "PIF",          icon: "folder_special",       color: "lime",   perms: ["pif.view","pif.create","pif.approve","pif.admin"] },
  { label: "Workplan",     icon: "calendar_month",       color: "sky",    perms: ["workplan.view","workplan.create","workplan.approve","workplan.admin"] },
  { label: "Assignments",  icon: "task_alt",             color: "stone",  perms: ["assignments.view","assignments.create","assignments.issue","assignments.admin"] },
  { label: "Calendar",     icon: "event",                color: "fuchsia",perms: ["calendar.view","calendar.create","calendar.admin"] },
  { label: "Support",      icon: "support_agent",        color: "zinc",   perms: ["support.view","support.create","support.admin"] },
  { label: "Users",        icon: "manage_accounts",      color: "indigo", perms: ["users.view","users.create","users.edit","users.deactivate","users.delete"] },
  { label: "Roles",        icon: "admin_panel_settings", color: "slate",  perms: ["roles.view","roles.manage","system.admin"] },
  { label: "Reports",      icon: "bar_chart",            color: "cyan",   perms: ["reports.view","reports.export","reports.audit","audit.view","audit.export"] },
];

const GROUP_COLORS: Record<string, { header: string; pill: string }> = {
  blue:    { header: "bg-blue-50",    pill: "bg-blue-100 text-blue-700" },
  emerald: { header: "bg-emerald-50", pill: "bg-emerald-100 text-emerald-700" },
  amber:   { header: "bg-amber-50",   pill: "bg-amber-100 text-amber-700" },
  violet:  { header: "bg-violet-50",  pill: "bg-violet-100 text-violet-700" },
  orange:  { header: "bg-orange-50",  pill: "bg-orange-100 text-orange-700" },
  teal:    { header: "bg-teal-50",    pill: "bg-teal-100 text-teal-700" },
  purple:  { header: "bg-purple-50",  pill: "bg-purple-100 text-purple-700" },
  pink:    { header: "bg-pink-50",    pill: "bg-pink-100 text-pink-700" },
  rose:    { header: "bg-rose-50",    pill: "bg-rose-100 text-rose-700" },
  yellow:  { header: "bg-yellow-50",  pill: "bg-yellow-100 text-yellow-700" },
  red:     { header: "bg-red-50",     pill: "bg-red-100 text-red-700" },
  lime:    { header: "bg-lime-50",    pill: "bg-lime-100 text-lime-700" },
  sky:     { header: "bg-sky-50",     pill: "bg-sky-100 text-sky-700" },
  stone:   { header: "bg-stone-50",   pill: "bg-stone-100 text-stone-700" },
  fuchsia: { header: "bg-fuchsia-50", pill: "bg-fuchsia-100 text-fuchsia-700" },
  zinc:    { header: "bg-zinc-50",    pill: "bg-zinc-100 text-zinc-700" },
  indigo:  { header: "bg-indigo-50",  pill: "bg-indigo-100 text-indigo-700" },
  slate:   { header: "bg-slate-50",   pill: "bg-slate-100 text-slate-700" },
  cyan:    { header: "bg-cyan-50",    pill: "bg-cyan-100 text-cyan-700" },
};

function permLabel(perm: string): string {
  const part = perm.split(".")[1] ?? perm;
  return part.charAt(0).toUpperCase() + part.slice(1);
}

function permissionCount(role: Role): number {
  const p = role.permissions;
  if (Array.isArray(p)) return p.length;
  return 0;
}

export default function AdminRolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permSets, setPermSets] = useState<Record<number, Set<string>>>({});
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const { confirm } = useConfirm();

  useEffect(() => {
    setIsAdmin(isSystemAdmin(getStoredUser()));
  }, []);

  useEffect(() => {
    setLoading(true);
    adminApi
      .listRoles()
      .then((res) => {
        const loaded: Role[] = res.data.roles ?? [];
        setRoles(loaded);
        const sets: Record<number, Set<string>> = {};
        for (const role of loaded) {
          const perms = role.permissions ?? [];
          sets[role.id] = new Set(perms.map((x) => (typeof x === "string" ? x : x.name)));
        }
        setPermSets(sets);
      })
      .catch(() => setError("Failed to load roles."))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (role: Role) => {
    if (PROTECTED_NAMES.includes(role.name)) {
      setError("This role cannot be deleted.");
      return;
    }
    const ok = await confirm({
      title: "Delete role",
      message: `Are you sure you want to delete the role "${role.name}"? Users with this role will lose it.`,
    });
    if (!ok) return;
    setActionLoading(role.id);
    try {
      await adminApi.deleteRole(role.id);
      setRoles((prev) => prev.filter((r) => r.id !== role.id));
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Failed to delete role.";
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  async function togglePerm(role: Role, permName: string) {
    if (PROTECTED_NAMES.includes(role.name)) return;
    const key = `${role.id}-${permName}`;
    const current = new Set(permSets[role.id] ?? []);
    const snapshot = new Set(current);
    current.has(permName) ? current.delete(permName) : current.add(permName);
    setPermSets((prev) => ({ ...prev, [role.id]: current }));
    setSavingCell(key);
    try {
      await adminApi.syncRolePermissions(role.id, Array.from(current));
    } catch {
      setPermSets((prev) => ({ ...prev, [role.id]: snapshot }));
      setError(`Failed to update ${permName} for ${role.name}.`);
    } finally {
      setSavingCell(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">Roles &amp; Permissions</h1>
          <p className="page-subtitle">
            Create and manage roles, assign permissions, and assign roles to users from User Management.
          </p>
        </div>
        {isAdmin && (
          <Link href="/admin/roles/create" className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Role
          </Link>
        )}
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-2">
          <span className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px]">error_outline</span>
            {error}
          </span>
          <button type="button" onClick={() => setError(null)} className="text-red-600 hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Roles summary table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="flex items-center justify-center gap-2 text-neutral-400">
              <span className="material-symbols-outlined animate-spin text-[20px]">progress_activity</span>
              <span className="text-sm">Loading roles…</span>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Role name</th>
                    <th>Permissions</th>
                    {isAdmin && <th className="text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {roles.map((role) => (
                    <tr key={role.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-neutral-900">{role.name}</p>
                          {PROTECTED_NAMES.includes(role.name) && (
                            <span className="material-symbols-outlined text-[14px] text-neutral-400" title="Protected role">lock</span>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="text-sm text-neutral-600">
                          {permissionCount(role)} permission{permissionCount(role) !== 1 ? "s" : ""}
                        </span>
                      </td>
                      {isAdmin && (
                        <td>
                          <div className="flex items-center justify-end gap-3">
                            <Link href={`/admin/roles/${role.id}/edit`} className="text-xs font-semibold text-primary hover:underline">
                              Edit
                            </Link>
                            {!PROTECTED_NAMES.includes(role.name) && (
                              <button
                                type="button"
                                onClick={() => handleDelete(role)}
                                disabled={actionLoading === role.id}
                                className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50"
                              >
                                {actionLoading === role.id ? "…" : "Delete"}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {roles.length === 0 && (
              <div className="py-16 text-center">
                <span className="material-symbols-outlined text-5xl text-neutral-200">admin_panel_settings</span>
                <p className="mt-3 text-sm font-medium text-neutral-500">No roles yet</p>
                {isAdmin && (
                  <Link href="/admin/roles/create" className="btn-primary mt-4 inline-flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    Add Role
                  </Link>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Permission Matrix */}
      {!loading && roles.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100">
            <h2 className="text-base font-semibold text-neutral-900">Permission Matrix</h2>
            <p className="text-xs text-neutral-500 mt-0.5">
              Click a checkbox to instantly toggle a permission for a role. Protected roles are read-only.
            </p>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="text-xs border-collapse min-w-max">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-r border-neutral-200 px-4 py-2 text-left min-w-[160px]">
                    Role
                  </th>
                  {MODULE_GROUPS.map((group) => {
                    const colors = GROUP_COLORS[group.color] ?? GROUP_COLORS.slate;
                    return (
                      <th
                        key={group.label}
                        colSpan={group.perms.length}
                        className={`border-b border-r border-neutral-200 px-2 py-2 text-center ${colors.header}`}
                      >
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors.pill}`}>
                          <span className="material-symbols-outlined text-[11px]">{group.icon}</span>
                          {group.label}
                        </span>
                      </th>
                    );
                  })}
                </tr>
                <tr>
                  <th className="sticky left-0 z-10 bg-white border-b border-r border-neutral-200 px-4 py-1.5" />
                  {MODULE_GROUPS.flatMap((group) =>
                    group.perms.map((perm) => (
                      <th
                        key={perm}
                        className="border-b border-r border-neutral-100 px-2 py-1.5 text-center font-medium text-neutral-500 whitespace-nowrap"
                        title={perm}
                      >
                        {permLabel(perm)}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => {
                  const isProtected = PROTECTED_NAMES.includes(role.name);
                  return (
                    <tr key={role.id} className={isProtected ? "bg-neutral-50 opacity-70" : "hover:bg-neutral-50/50"}>
                      <td className="sticky left-0 z-10 bg-inherit border-b border-r border-neutral-200 px-4 py-2 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          {isProtected && (
                            <span className="material-symbols-outlined text-[12px] text-neutral-400">lock</span>
                          )}
                          <span className="font-medium text-neutral-800">{role.name}</span>
                          {isAdmin && !isProtected && (
                            <Link href={`/admin/roles/${role.id}/edit`} className="text-[10px] text-primary hover:underline ml-1">
                              Edit
                            </Link>
                          )}
                        </div>
                      </td>
                      {MODULE_GROUPS.flatMap((group) =>
                        group.perms.map((perm) => {
                          const key = `${role.id}-${perm}`;
                          const checked = permSets[role.id]?.has(perm) ?? false;
                          const isSaving = savingCell === key;
                          return (
                            <td key={perm} className="border-b border-r border-neutral-100 px-2 py-2 text-center">
                              {isSaving ? (
                                <span className="material-symbols-outlined animate-spin text-[14px] text-primary">progress_activity</span>
                              ) : (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={isProtected || !isAdmin}
                                  onChange={() => togglePerm(role, perm)}
                                  className="rounded border-neutral-300 text-primary focus:ring-primary disabled:opacity-40 cursor-pointer disabled:cursor-default"
                                  title={`${checked ? "Revoke" : "Grant"} ${perm} for ${role.name}`}
                                />
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-800">Assigning roles to users</p>
        <p className="mt-1">
          Go to <Link href="/admin/users" className="text-primary font-medium hover:underline">User Management</Link>, create or edit a user,
          and select a role in the form. Each user can have one role; permissions are determined by that role.
        </p>
      </div>
    </div>
  );
}
